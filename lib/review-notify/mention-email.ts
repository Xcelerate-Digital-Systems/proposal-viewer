// lib/review-notify/mention-email.ts
// Builds the branded "@X mentioned you" email template.

import { htmlToPlainText } from '@/lib/feedback/mention-html';
import type { EmailBranding } from '@/lib/review-notification-emails';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildMentionEmail(args: {
  branding: EmailBranding;
  projectTitle: string;
  reviewUrl: string;
  itemTitle: string | null;
  actorName: string | null;
  commentContent: string | null;
  mentionedName: string;
}): { subject: string; html: string } {
  const actor = (args.actorName || 'Someone').trim();
  const item = args.itemTitle ? ` on ${args.itemTitle}` : '';
  const subject = `${actor} mentioned you${item}`;
  const preview = htmlToPlainText(args.commentContent ?? '').slice(0, 400);
  const accent = args.branding.accentColor;
  const logo = args.branding.logoUrl
    ? `<img src="${args.branding.logoUrl}" alt="${args.branding.companyName}" style="max-height:32px;margin-bottom:12px;" />`
    : '';
  const safePreview = preview
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f8f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">
    <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;">
      ${logo}
      <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">${escapeHtml(args.branding.companyName)} · ${escapeHtml(args.projectTitle)}</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">${escapeHtml(actor)} mentioned you${item ? ` <span style="color:#6b7280;font-weight:400;">on ${escapeHtml(args.itemTitle ?? '')}</span>` : ''}</h1>
      ${safePreview ? `<blockquote style="margin:0 0 20px;padding:12px 14px;border-left:3px solid ${accent};background:#f9fafb;border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:#374151;">${safePreview}</blockquote>` : ''}
      <a href="${args.reviewUrl}" style="display:inline-block;padding:10px 18px;background:${accent};color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Open the review</a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">You're receiving this because ${escapeHtml(actor)} @-mentioned ${escapeHtml(args.mentionedName)}.</p>
    </div>
  </body></html>`;
  return { subject, html };
}
