import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { fromEmail } from '@/lib/resend';
import { sendAndLogEmail } from '@/lib/email-log';
import { buildReviewUrl } from '@/lib/proposal-url';
import { buildReminderEmail, withUnsubscribeLink, type EmailBranding } from '@/lib/review-notification-emails';
import { buildUnsubscribeUrl } from '@/lib/feedback/unsubscribe-token';

// POST — send a manual reminder email to all active (non-removed) guests
// on this project. Optionally accepts { emails: string[] } to target
// specific guests; when omitted, all active guests are reminded.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetEmails = Array.isArray(body.emails)
    ? (body.emails as string[]).map((e: string) => e.trim().toLowerCase()).filter(Boolean)
    : null;

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('review_projects')
    .select('id, title, company_id, share_token, due_date')
    .eq('id', params.id)
    .single();
  if (!project || project.company_id !== auth.companyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let guestQuery = supabase
    .from('review_project_guest_recipients')
    .select('email, name')
    .eq('review_project_id', params.id)
    .is('removed_at', null);
  if (targetEmails && targetEmails.length > 0) {
    guestQuery = guestQuery.in('email', targetEmails);
  }
  const { data: guests } = await guestQuery;

  if (!guests || guests.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active guests to remind' });
  }

  const [{ data: company }, { data: senderMember }, { data: items }, { data: comments }] = await Promise.all([
    supabase
      .from('companies')
      .select('name, custom_domain, domain_verified, logo_path, accent_color')
      .eq('id', project.company_id)
      .single(),
    supabase
      .from('team_members')
      .select('name, email')
      .eq('user_id', auth.member.user_id)
      .eq('company_id', auth.companyId)
      .maybeSingle(),
    supabase
      .from('review_items')
      .select('id')
      .eq('review_project_id', params.id),
    supabase
      .from('review_comments')
      .select('id')
      .eq('resolved', false)
      .is('parent_comment_id', null)
      .in(
        'review_item_id',
        (await supabase.from('review_items').select('id').eq('review_project_id', params.id))
          .data?.map((r) => r.id) ?? [],
      ),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const verifiedDomain = company?.domain_verified ? company.custom_domain : null;
  const reviewUrl = buildReviewUrl(project.share_token, verifiedDomain, appUrl);
  const companyName = company?.name || 'Your agency';
  const accentColor = company?.accent_color || '#017C87';
  const logoUrl = company?.logo_path
    ? supabase.storage.from('company-assets').getPublicUrl(company.logo_path).data.publicUrl
    : null;
  const branding: EmailBranding = { companyName, accentColor, logoUrl };
  const senderName = senderMember?.name || senderMember?.email || companyName;

  const dueDate = project.due_date
    ? new Date(project.due_date + 'T00:00:00').toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  const totalItems = items?.length ?? 0;
  const openComments = comments?.length ?? 0;

  let sent = 0;
  for (const guest of guests) {
    const email = (guest.email as string).trim().toLowerCase();
    const name = (guest.name as string | null) ?? '';
    try {
      const { subject, html } = buildReminderEmail({
        branding,
        projectTitle: project.title,
        reviewUrl,
        guestName: name,
        senderName,
        dueDate,
        openComments,
        totalItems,
      });
      const unsub = buildUnsubscribeUrl(appUrl, project.id, email);
      await sendAndLogEmail({
        from: fromEmail(companyName),
        to: email,
        subject,
        html: withUnsubscribeLink(html, unsub),
        companyId: project.company_id,
        category: 'campaign_reminder',
        eventType: 'reminder',
        entityType: 'campaign',
        entityId: project.id,
      });
      sent++;
    } catch (err) {
      console.error(`[remind] Failed to send to ${email}:`, err);
    }
  }

  return NextResponse.json({ sent, total: guests.length });
}
