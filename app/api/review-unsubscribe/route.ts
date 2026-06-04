import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { verifyUnsubscribeToken } from '@/lib/feedback/unsubscribe-token';

export const dynamic = 'force-dynamic';

// GET — renders a small self-contained HTML page with a confirm button.
// The guest clicks the link in the email footer, sees the page, clicks
// "Unsubscribe", which POSTs back here. No auth required — the HMAC
// token proves the email address.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    return new NextResponse(renderPage('Invalid or expired link', null, null), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const done = req.nextUrl.searchParams.get('done') === '1';
  if (done) {
    return new NextResponse(
      renderPage(
        'You have been unsubscribed',
        `<b>${escapeHtml(parsed.email)}</b> will no longer receive email notifications for this review project.`,
        null,
      ),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from('review_projects')
    .select('title, companies!inner(accent_color)')
    .eq('id', parsed.projectId)
    .maybeSingle();

  const projectTitle = project?.title || 'this review project';
  const accentColor = (project?.companies as unknown as { accent_color: string } | null)?.accent_color || '#017C87';

  return new NextResponse(
    renderPage(
      `Unsubscribe from "${escapeHtml(projectTitle)}"?`,
      `<b>${escapeHtml(parsed.email)}</b> will stop receiving all email notifications for this project.`,
      token,
      accentColor,
    ),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

// POST — actually marks the guest as removed and redirects back to ?done=1.
export async function POST(req: NextRequest) {
  let token: string;
  try {
    const form = await req.formData();
    token = (form.get('token') as string) || '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  const supabase = createServiceClient();

  await supabase
    .from('review_project_guest_recipients')
    .update({
      removed_at: new Date().toISOString(),
      notify_comment: false,
      notify_reply: false,
      notify_resolve: false,
      notify_status: false,
      notify_new_version: false,
    })
    .eq('review_project_id', parsed.projectId)
    .eq('email', parsed.email);

  const redirectUrl = new URL(req.url);
  redirectUrl.search = `?token=${encodeURIComponent(token)}&done=1`;
  return NextResponse.redirect(redirectUrl.toString(), 303);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPage(heading: string, body: string | null, token: string | null, accentColor = '#017C87'): string {
  const formHtml = token
    ? `<form method="POST" style="margin-top:24px;">
         <input type="hidden" name="token" value="${escapeHtml(token)}" />
         <button type="submit" style="background:${escapeHtml(accentColor)};color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
           Unsubscribe
         </button>
       </form>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:40px 20px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;">
    <h1 style="font-size:20px;font-weight:600;margin:0 0 12px;">${heading}</h1>
    ${body ? `<p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0;">${body}</p>` : ''}
    ${formHtml}
  </div>
</body></html>`;
}
