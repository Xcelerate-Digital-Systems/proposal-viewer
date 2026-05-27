/**
 * Email builders for review notifications.
 *
 * - Comment events go through `buildCommentDigestEmail` (1+ events grouped).
 * - Status events go through dedicated immediate-send builders.
 * All three share the same `EmailBranding` header + accent color so an agency
 * sees their logo and brand color on every notification kind.
 */

export interface EmailBranding {
  companyName: string;
  accentColor: string;
  logoUrl: string | null;
}

export function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Header strip — logo if we have one, else the agency name. */
function renderHeader(branding: EmailBranding) {
  const inner = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.companyName)}" style="display:block;max-height:32px;max-width:200px;height:auto;width:auto;border:0;outline:none;text-decoration:none;" />`
    : `<span style="color:#ffffff;font-weight:700;font-size:16px;">${escapeHtml(branding.companyName)}</span>`;
  return `<tr><td style="background:#043946;padding:18px 32px;">${inner}</td></tr>`;
}

function ctaButton(href: string, label: string, accentColor: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${escapeHtml(accentColor)};color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">${escapeHtml(label)}</a>`;
}

function shell(branding: EmailBranding, bodyHtml: string, footerHtml: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        ${renderHeader(branding)}
        <tr><td style="padding:32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">${footerHtml}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ──────────────────────────────────────────────────────────────────────────
// Comment digest
// ──────────────────────────────────────────────────────────────────────────

export interface DigestCommentEntry {
  author: string;
  content: string;
  itemTitle: string | null;
  screenshotUrl: string | null;
  isReply: boolean;
  parentAuthor: string | null;
  parentContent: string | null;
  createdAt: string;
}

export function buildCommentDigestEmail(params: {
  branding: EmailBranding;
  projectTitle: string;
  reviewUrl: string;
  entries: DigestCommentEntry[];
}): { subject: string; html: string } {
  const { branding, projectTitle, reviewUrl, entries } = params;

  const count = entries.length;
  const uniqueAuthors = Array.from(new Set(entries.map((e) => e.author))).slice(0, 3);
  const authorList =
    uniqueAuthors.length === 1
      ? uniqueAuthors[0]
      : uniqueAuthors.length === 2
        ? `${uniqueAuthors[0]} and ${uniqueAuthors[1]}`
        : `${uniqueAuthors.slice(0, -1).join(', ')} and others`;

  const subject =
    count === 1
      ? `💬 ${uniqueAuthors[0]} commented on "${projectTitle}"`
      : `💬 ${count} new comments on "${projectTitle}"`;

  const headline =
    count === 1
      ? entries[0].isReply
        ? `${authorList} replied`
        : `${authorList} left a comment`
      : `${count} new comments from ${authorList}`;

  const entryBlocks = entries
    .map((e) => {
      const verb = e.isReply ? 'replied' : 'commented';
      const itemRef = e.itemTitle ? ` on <strong>${escapeHtml(e.itemTitle)}</strong>` : '';
      const parentBlock =
        e.isReply && e.parentContent
          ? `<div style="margin:0 0 10px;padding:8px 12px;background:#f9fafb;border-left:3px solid #d1d5db;border-radius:4px;">
               <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;">${escapeHtml(e.parentAuthor || 'Original')} wrote</p>
               <p style="margin:0;color:#6b7280;font-size:13px;">${escapeHtml(e.parentContent)}</p>
             </div>`
          : '';
      const screenshotBlock = e.screenshotUrl
        ? `<a href="${escapeHtml(reviewUrl)}" style="display:block;margin:0 0 12px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
             <img src="${escapeHtml(e.screenshotUrl)}" alt="Screenshot" style="display:block;width:100%;height:auto;max-width:100%;border:0;outline:none;text-decoration:none;" />
           </a>`
        : '';
      return `<div style="margin:0 0 24px;padding:16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">
        <p style="margin:0 0 10px;color:#374151;font-size:13px;">
          <strong style="color:#111827;">${escapeHtml(e.author)}</strong>
          <span style="color:#9ca3af;"> ${verb}${itemRef}</span>
        </p>
        ${screenshotBlock}
        ${parentBlock}
        <div style="background:#f3fafa;border-left:3px solid ${escapeHtml(branding.accentColor)};padding:10px 14px;border-radius:4px;">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(e.content)}</p>
        </div>
      </div>`;
    })
    .join('');

  const body = `
    <h1 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:600;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">In <strong>${escapeHtml(projectTitle)}</strong></p>
    ${entryBlocks}
    <div style="margin-top:8px;">${ctaButton(reviewUrl, count === 1 ? 'View comment' : 'View all comments', branding.accentColor)}</div>
  `;

  return {
    subject,
    html: shell(
      branding,
      body,
      `You're receiving this because you're assigned to or participating in this project's threads.`,
    ),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Status events (immediate send)
// ──────────────────────────────────────────────────────────────────────────

export type StatusEvent =
  | { kind: 'review_comment_resolved'; resolvedBy?: string; itemTitle?: string }
  | { kind: 'review_item_approved'; itemTitle?: string }
  | { kind: 'review_item_revision_needed'; itemTitle?: string }
  | { kind: 'review_feedback_marked_complete'; reviewer?: string; message?: string };

export function buildStatusEmail(params: {
  branding: EmailBranding;
  projectTitle: string;
  reviewUrl: string;
  dashboardUrl: string;
  event: StatusEvent;
}): { subject: string; html: string } {
  const { branding, projectTitle, reviewUrl, dashboardUrl, event } = params;

  let subject = '';
  let headline = '';
  let body = '';
  const itemRef = (t?: string) => (t ? ` on "${escapeHtml(t)}"` : '');

  switch (event.kind) {
    case 'review_comment_resolved':
      subject = `✔️ Feedback comment resolved on "${projectTitle}"`;
      headline = 'Comment resolved';
      body = `<p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;"><strong>${escapeHtml(event.resolvedBy || 'Someone')}</strong> resolved a comment${itemRef(event.itemTitle)} in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>`;
      break;
    case 'review_item_approved':
      subject = `✅ Item approved in "${projectTitle}"`;
      headline = 'Item approved';
      body = `<p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;"><strong>"${escapeHtml(event.itemTitle || 'An item')}"</strong> has been marked as approved in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>`;
      break;
    case 'review_item_revision_needed':
      subject = `⚠️ Revision needed in "${projectTitle}"`;
      headline = 'Revision needed';
      body = `<p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;"><strong>"${escapeHtml(event.itemTitle || 'An item')}"</strong> needs revisions in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>`;
      break;
    case 'review_feedback_marked_complete': {
      subject = `✅ Review finished on "${projectTitle}"`;
      headline = 'Review complete';
      const msg = event.message
        ? `<div style="background:#f3fafa;border-left:3px solid ${escapeHtml(branding.accentColor)};padding:12px 16px;margin:16px 0;border-radius:4px;"><p style="margin:0;color:#374151;">${escapeHtml(event.message)}</p></div>`
        : '';
      body = `<p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;"><strong>${escapeHtml(event.reviewer || 'A reviewer')}</strong> has finished reviewing <strong>"${escapeHtml(projectTitle)}"</strong>.</p>${msg}`;
      break;
    }
  }

  const html = shell(
    branding,
    `<h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${escapeHtml(headline)}</h1>
     <div style="color:#6b7280;font-size:15px;line-height:1.6;">${body}</div>
     <div style="margin-top:28px;">
       ${ctaButton(reviewUrl, 'View feedback', branding.accentColor)}
       <a href="${escapeHtml(dashboardUrl)}/reviews" style="display:inline-block;margin-left:8px;background:#f9fafb;color:#6b7280;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;border:1px solid #e5e7eb;">Dashboard</a>
     </div>`,
    `You're receiving this because you're assigned to this project. Manage assignments in the project's Settings tab.`,
  );

  return { subject, html };
}

export function buildNewVersionEmail(params: {
  branding: EmailBranding;
  projectTitle: string;
  reviewUrl: string;
  itemTitle?: string;
  versionAuthor?: string;
  versionNotes?: string;
}): { subject: string; html: string } {
  const { branding, projectTitle, reviewUrl, itemTitle, versionAuthor, versionNotes } = params;

  const subject = `📦 New version ready for review${itemTitle ? ` — ${itemTitle}` : ''}`;
  const headline = 'Ready for your review';

  const notesBlock = versionNotes
    ? `<p style="margin:16px 0 4px;color:#6b7280;font-size:13px;">${escapeHtml(versionAuthor || branding.companyName)} wrote:</p>
       <div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 14px;margin:0 0 16px;border-radius:4px;">
         <p style="margin:0;color:#6b7280;font-size:14px;">${escapeHtml(versionNotes)}</p>
       </div>`
    : '';

  const body = `<h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${escapeHtml(headline)}</h1>
    <div style="color:#6b7280;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 12px;">${escapeHtml(versionAuthor || branding.companyName)} uploaded a new version of <strong>"${escapeHtml(itemTitle || 'an item')}"</strong> in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>
      ${notesBlock}
      <p style="color:#6b7280;font-size:14px;">Open the project to take a look and leave feedback.</p>
    </div>
    <div style="margin-top:28px;">${ctaButton(reviewUrl, 'Review the new version', branding.accentColor)}</div>`;

  return {
    subject,
    html: shell(
      branding,
      body,
      `You're receiving this because you've previously participated in this project.`,
    ),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Comment assignment
// ──────────────────────────────────────────────────────────────────────────

export function buildAssignmentEmail(params: {
  branding: EmailBranding;
  projectTitle: string;
  /** Deep link straight to the item the comment lives on */
  itemUrl: string;
  itemTitle: string | null;
  assignerName: string;
  assigneeName: string;
  commentContent: string | null;
  assignmentNote: string | null;
}): { subject: string; html: string } {
  const {
    branding, projectTitle, itemUrl, itemTitle,
    assignerName, assigneeName, commentContent, assignmentNote,
  } = params;

  const subject = `${assignerName} assigned you a task${itemTitle ? ` on ${itemTitle}` : ''}`;

  const commentBlock = commentContent
    ? `<div style="background:#f9fafb;border-left:3px solid ${escapeHtml(branding.accentColor)};padding:10px 14px;margin:0 0 16px;border-radius:4px;">
         <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(commentContent)}</p>
       </div>`
    : '';

  const noteBlock = assignmentNote
    ? `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Instructions:</p>
       <div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 14px;margin:0 0 16px;border-radius:4px;">
         <p style="margin:0;color:#92400e;font-size:14px;line-height:1.6;">${escapeHtml(assignmentNote)}</p>
       </div>`
    : '';

  const body = `<h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">You've been assigned a task</h1>
    <div style="color:#6b7280;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 12px;">${escapeHtml(assignerName)} assigned you to fix an issue${itemTitle ? ` on <strong>"${escapeHtml(itemTitle)}"</strong>` : ''} in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>
      ${commentBlock}
      ${noteBlock}
      <p style="color:#6b7280;font-size:14px;">Open the item to see the full context and mark the assignment complete when you're done.</p>
    </div>
    <div style="margin-top:28px;">${ctaButton(itemUrl, 'View Assignment', branding.accentColor)}</div>`;

  return {
    subject,
    html: shell(
      branding,
      body,
      `You're receiving this because ${escapeHtml(assignerName)} assigned you to this task.`,
    ),
  };
}
