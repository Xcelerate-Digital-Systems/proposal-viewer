import { createServiceClient } from '@/lib/supabase-server';
import { fromEmail } from '@/lib/resend';
import { sendAndLogEmail } from '@/lib/email-log';
import { buildReviewUrl } from '@/lib/proposal-url';
import { buildGuestInviteEmail, withUnsubscribeLink, type EmailBranding } from '@/lib/review-notification-emails';
import { buildUnsubscribeUrl } from '@/lib/feedback/unsubscribe-token';

export async function sendGuestInviteEmail(opts: {
  supabase: ReturnType<typeof createServiceClient>;
  projectId: string;
  guestEmail: string;
  guestName: string;
  inviterUserId: string;
}) {
  const { supabase, projectId, guestEmail, guestName, inviterUserId } = opts;

  const { data: project } = await supabase
    .from('review_projects')
    .select('title, share_token, company_id')
    .eq('id', projectId)
    .single();
  if (!project) return;

  const [{ data: company }, { data: inviterMember }] = await Promise.all([
    supabase
      .from('companies')
      .select('name, custom_domain, domain_verified, logo_path, accent_color')
      .eq('id', project.company_id)
      .single(),
    supabase
      .from('team_members')
      .select('name, email')
      .eq('user_id', inviterUserId)
      .eq('company_id', project.company_id)
      .maybeSingle(),
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
  const inviterName = inviterMember?.name || inviterMember?.email || companyName;

  const { subject, html } = buildGuestInviteEmail({
    branding,
    projectTitle: project.title,
    reviewUrl,
    guestName,
    inviterName,
  });

  const unsub = buildUnsubscribeUrl(appUrl, projectId, guestEmail);
  await sendAndLogEmail({
    from: fromEmail(companyName), to: guestEmail, subject,
    html: withUnsubscribeLink(html, unsub),
    companyId: project.company_id,
    category: 'campaign_invite',
    eventType: 'guest_invite',
    entityType: 'campaign',
    entityId: projectId,
  });
}
