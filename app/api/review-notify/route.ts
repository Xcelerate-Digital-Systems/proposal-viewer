// app/api/review-notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getResend, FROM_EMAIL } from '@/lib/resend';
import { buildReviewUrl } from '@/lib/proposal-url';
import crypto from 'crypto';
import { isValidWebhookUrl } from '@/lib/sanitize';

type ReviewEventType =
  | 'review_comment_added'
  | 'review_comment_resolved'
  | 'review_item_approved'
  | 'review_item_revision_needed'
  | 'review_feedback_marked_complete'
  | 'review_item_new_version';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      event_type,
      share_token,
      review_item_id,
      comment_author,
      comment_author_email,
      comment_content,
      parent_comment_id,
      resolved_by,
      item_title,
    } = body as {
      event_type: ReviewEventType;
      share_token: string;
      review_item_id?: string;
      comment_author?: string;
      comment_author_email?: string;
      comment_content?: string;
      parent_comment_id?: string;
      resolved_by?: string;
      item_title?: string;
    };

    if (!event_type || !share_token) {
      return NextResponse.json({ error: 'Missing event_type or share_token' }, { status: 400 });
    }

    const validEvents: ReviewEventType[] = [
      'review_comment_added', 'review_comment_resolved',
      'review_item_approved', 'review_item_revision_needed',
      'review_feedback_marked_complete', 'review_item_new_version',
    ];
    if (!validEvents.includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, title, client_name, client_email, company_id, share_token, created_by')
      .eq('share_token', share_token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Feedback project not found' }, { status: 404 });
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name, custom_domain, domain_verified')
      .eq('id', project.company_id)
      .single();

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const verifiedDomain = company?.domain_verified ? company.custom_domain : null;
    const reviewUrl = buildReviewUrl(project.share_token, verifiedDomain, appUrl);
    const companyName = company?.name || 'Your agency';

    const isComment = event_type === 'review_comment_added';
    const isReply = isComment && !!parent_comment_id;
    const isNewVersion = event_type === 'review_item_new_version';
    const actorEmail = (comment_author_email || resolved_by || '').trim().toLowerCase() || null;

    // Resolve recipient emails per the project's assignment + thread rules.
    const recipientEmails = await collectRecipients({
      supabase,
      projectId: project.id,
      reviewItemId: review_item_id ?? null,
      isComment,
      isReply,
      isNewVersion,
      parentCommentId: parent_comment_id ?? null,
      projectClientEmail: project.client_email,
      excludeEmail: actorEmail,
    });

    let sent = 0;
    if (recipientEmails.size > 0) {
      const { subject, html } = isComment
        ? await buildCommentEmailForBatch({
            supabase, isReply, parent_comment_id, project, companyName,
            reviewUrl, comment_author, comment_content, item_title,
          })
        : isNewVersion
        ? buildNewVersionEmail({
            projectTitle: project.title, companyName, reviewUrl,
            itemTitle: item_title, versionAuthor: comment_author,
            versionNotes: comment_content,
          })
        : buildReviewTeamEmail({
            event_type, projectTitle: project.title, clientName: project.client_name,
            reviewUrl, dashboardUrl: appUrl, commentAuthor: comment_author,
            commentContent: comment_content, resolvedBy: resolved_by, itemTitle: item_title,
          });

      for (const email of Array.from(recipientEmails)) {
        try {
          await getResend().emails.send({ from: FROM_EMAIL, to: email, subject, html });
          sent++;
        } catch (err) {
          console.error(`Failed to notify ${email}:`, err);
        }
      }

      try {
        await supabase.from('notification_log').insert({
          team_member_id: null as unknown as string,
          event_type: isReply ? 'review_comment_replied' : event_type,
          event_ref: `${event_type}_${Date.now()}`,
          company_id: project.company_id,
          review_project_id: project.id,
        });
      } catch (err) {
        console.error('Notification log insert failed:', err);
      }
    }

    // Webhooks fire independently of email settings.
    try {
      await fireReviewWebhooks({
        event_type, company_id: project.company_id, custom_domain: verifiedDomain,
        project: { id: project.id, title: project.title, client_name: project.client_name, share_token: project.share_token },
        review_item_id, comment_author, comment_content, resolved_by, item_title,
      });
    } catch (err) {
      console.error('Review webhook dispatch error:', err);
    }

    return NextResponse.json({ sent, recipients: recipientEmails.size });
  } catch (err) {
    console.error('Review notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Recipients = assigned agency team members, plus:
//  - on replies: prior thread participants
//  - on new-version: the project's client_email + everyone who has commented
//    on the item in any earlier version
// The actor (comment author / resolver / version uploader) is excluded so
// they don't email themselves.
async function collectRecipients(params: {
  supabase: ReturnType<typeof createServiceClient>;
  projectId: string;
  reviewItemId: string | null;
  isComment: boolean;
  isReply: boolean;
  isNewVersion: boolean;
  parentCommentId: string | null;
  projectClientEmail: string | null;
  excludeEmail: string | null;
}): Promise<Set<string>> {
  const {
    supabase, projectId, reviewItemId, isComment, isReply, isNewVersion,
    parentCommentId, projectClientEmail, excludeEmail,
  } = params;
  const recipients = new Set<string>();

  // Assigned agency team members get every event on this project.
  const { data: assignees } = await supabase
    .from('review_project_assignees')
    .select('team_member:team_members(email)')
    .eq('review_project_id', projectId);

  for (const row of assignees ?? []) {
    // Supabase types the joined relation as either an array or a single
    // object depending on inference; normalise both shapes.
    const rel = (row as { team_member: { email: string | null } | { email: string | null }[] | null }).team_member;
    const members = Array.isArray(rel) ? rel : rel ? [rel] : [];
    for (const tm of members) {
      const email = tm?.email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  // Replies also notify guests who participated in that thread (the parent
  // comment's author + any earlier replier on it).
  if (isComment && isReply && parentCommentId) {
    const { data: parent } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('id', parentCommentId)
      .maybeSingle();
    const parentEmail = parent?.author_email?.trim().toLowerCase();
    if (parentEmail) recipients.add(parentEmail);

    const { data: siblings } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('parent_comment_id', parentCommentId)
      .not('author_email', 'is', null);
    for (const row of siblings ?? []) {
      const email = (row as { author_email: string | null }).author_email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  // New-version notifications also pull in the project's client_email plus
  // anyone who has previously commented on the item — they're the people
  // who asked for the revisions.
  if (isNewVersion && reviewItemId) {
    const clientEmail = projectClientEmail?.trim().toLowerCase();
    if (clientEmail) recipients.add(clientEmail);

    const { data: itemAuthors } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('review_item_id', reviewItemId)
      .not('author_email', 'is', null);
    for (const row of itemAuthors ?? []) {
      const email = (row as { author_email: string | null }).author_email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  if (excludeEmail) recipients.delete(excludeEmail);

  return recipients;
}

async function buildCommentEmailForBatch(params: {
  supabase: ReturnType<typeof createServiceClient>;
  isReply: boolean;
  parent_comment_id?: string;
  project: { title: string };
  companyName: string;
  reviewUrl: string;
  comment_author?: string;
  comment_content?: string;
  item_title?: string;
}) {
  const { supabase, isReply, parent_comment_id, project, companyName, reviewUrl, comment_author, comment_content, item_title } = params;

  let parentContent: string | null = null;
  let parentAuthor: string | null = null;
  if (isReply && parent_comment_id) {
    const { data: parent } = await supabase
      .from('review_comments')
      .select('content, author_name')
      .eq('id', parent_comment_id)
      .maybeSingle();
    parentContent = parent?.content ?? null;
    parentAuthor = parent?.author_name ?? null;
  }

  return buildParticipantCommentEmail({
    isReply,
    projectTitle: project.title,
    companyName,
    reviewUrl,
    commentAuthor: comment_author,
    commentContent: comment_content,
    itemTitle: item_title,
    parentAuthor,
    parentContent,
  });
}

// --- Webhooks ---

async function fireReviewWebhooks(payload: {
  event_type: ReviewEventType;
  company_id: string;
  custom_domain?: string | null;
  project: { id: string; title: string; client_name: string; share_token: string };
  review_item_id?: string;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
  item_title?: string;
}) {
  const supabase = createServiceClient();

  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('company_id', payload.company_id)
    .eq('enabled', true)
    .eq('event_type', payload.event_type);

  if (!webhooks || webhooks.length === 0) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const body = JSON.stringify({
    event: payload.event_type,
    timestamp: new Date().toISOString(),
    review_project: {
      id: payload.project.id,
      title: payload.project.title,
      client_name: payload.project.client_name,
      viewer_url: buildReviewUrl(payload.project.share_token, payload.custom_domain, appUrl),
    },
    ...(payload.review_item_id && { review_item_id: payload.review_item_id }),
    ...(payload.item_title && { item_title: payload.item_title }),
    ...(payload.comment_author && {
      comment: {
        author: payload.comment_author,
        content: payload.comment_content,
      },
    }),
    ...(payload.resolved_by && { resolved_by: payload.resolved_by }),
  });

  for (const webhook of webhooks) {
    try {
      if (!isValidWebhookUrl(webhook.url)) {
        console.warn(`Skipping review webhook with invalid/private URL: ${webhook.url}`);
        continue;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AgencyViz-Webhooks/1.0',
      };

      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error(`Review webhook failed for ${webhook.url}:`, err);
    }
  }
}

// --- Email helpers ---

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildReviewTeamEmail(params: {
  event_type: ReviewEventType;
  projectTitle: string;
  clientName: string;
  reviewUrl: string;
  dashboardUrl: string;
  commentAuthor?: string;
  commentContent?: string;
  resolvedBy?: string;
  itemTitle?: string;
}): { subject: string; html: string } {
  const { event_type, projectTitle, reviewUrl, dashboardUrl, commentAuthor, commentContent, resolvedBy, itemTitle } = params;

  let subject = '';
  let headline = '';
  let body = '';
  const itemRef = itemTitle ? ` on "${escapeHtml(itemTitle)}"` : '';

  switch (event_type) {
    case 'review_comment_added':
      subject = `💬 New review comment on "${projectTitle}"`;
      headline = 'New Feedback Comment';
      body = `
        <p><strong>${escapeHtml(commentAuthor || 'Someone')}</strong> commented${itemRef} in <strong>"${escapeHtml(projectTitle)}"</strong>:</p>
        <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
        </div>
      `;
      break;

    case 'review_comment_resolved':
      subject = `✔️ Feedback comment resolved on "${projectTitle}"`;
      headline = 'Comment Resolved';
      body = `<p><strong>${escapeHtml(resolvedBy || 'Someone')}</strong> resolved a comment${itemRef} in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>`;
      break;

    case 'review_item_approved':
      subject = `✅ Item approved in "${projectTitle}"`;
      headline = 'Item Approved';
      body = `<p><strong>"${escapeHtml(itemTitle || 'An item')}"</strong> has been marked as approved in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>`;
      break;

    case 'review_item_revision_needed':
      subject = `⚠️ Revision needed in "${projectTitle}"`;
      headline = 'Revision Needed';
      body = `<p><strong>"${escapeHtml(itemTitle || 'An item')}"</strong> needs revisions in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>`;
      break;

    case 'review_feedback_marked_complete': {
      subject = `✅ Review finished on "${projectTitle}"`;
      headline = 'Review Complete';
      const msgBlock = commentContent
        ? `<div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;"><p style="margin:0;color:#374151;">${escapeHtml(commentContent)}</p></div>`
        : '';
      body = `<p><strong>${escapeHtml(commentAuthor || 'A reviewer')}</strong> has finished reviewing <strong>"${escapeHtml(projectTitle)}"</strong>.</p>${msgBlock}`;
      break;
    }
  }

  return {
    subject,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#043946;padding:20px 32px;"><span style="color:#ffffff;font-weight:700;font-size:16px;">AgencyViz</span></td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
          <div style="color:#6b7280;font-size:15px;line-height:1.6;">${body}</div>
          <div style="margin-top:28px;">
            <a href="${reviewUrl}" style="display:inline-block;background:#017C87;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;margin-right:8px;">View Feedback</a>
            <a href="${dashboardUrl}/reviews" style="display:inline-block;background:#f9fafb;color:#6b7280;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;border:1px solid #e5e7eb;">Dashboard</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">You're receiving this because you're assigned to this project. Manage assignments in the project's Settings tab.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

function buildParticipantCommentEmail(params: {
  isReply: boolean;
  projectTitle: string;
  companyName: string;
  reviewUrl: string;
  commentAuthor?: string;
  commentContent?: string;
  itemTitle?: string;
  parentAuthor: string | null;
  parentContent: string | null;
}): { subject: string; html: string } {
  const {
    isReply, projectTitle, companyName, reviewUrl,
    commentAuthor, commentContent, itemTitle, parentAuthor, parentContent,
  } = params;

  const author = commentAuthor || 'Someone';
  const itemRef = itemTitle ? ` on "${escapeHtml(itemTitle)}"` : '';

  const subject = isReply
    ? `↩️ ${author} replied in "${projectTitle}"`
    : `💬 ${author} commented on "${projectTitle}"`;

  const headline = isReply ? 'New reply' : 'New comment';

  const parentBlock = isReply && parentContent
    ? `
      <p style="margin:16px 0 4px;color:#6b7280;font-size:13px;">
        ${escapeHtml(parentAuthor || 'Original comment')} wrote:
      </p>
      <div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 14px;margin:0 0 16px;border-radius:4px;">
        <p style="margin:0;color:#6b7280;font-size:14px;">${escapeHtml(parentContent)}</p>
      </div>
    `
    : '';

  const lead = isReply
    ? `<p><strong>${escapeHtml(author)}</strong> replied${itemRef} in <strong>"${escapeHtml(projectTitle)}"</strong>:</p>`
    : `<p><strong>${escapeHtml(author)}</strong> commented${itemRef} in <strong>"${escapeHtml(projectTitle)}"</strong>:</p>`;

  const body = `
    ${parentBlock}
    ${lead}
    <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
      <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
    </div>
  `;

  return {
    subject,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#043946;padding:20px 32px;"><span style="color:#ffffff;font-weight:700;font-size:16px;">${escapeHtml(companyName)}</span></td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
          <div style="color:#6b7280;font-size:15px;line-height:1.6;">${body}</div>
          <div style="margin-top:28px;">
            <a href="${reviewUrl}" style="display:inline-block;background:#017C87;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Open in feedback</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">You're receiving this because you're assigned to or participating in this project's threads.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

function buildNewVersionEmail(params: {
  projectTitle: string;
  companyName: string;
  reviewUrl: string;
  itemTitle?: string;
  versionAuthor?: string;
  versionNotes?: string;
}): { subject: string; html: string } {
  const { projectTitle, companyName, reviewUrl, itemTitle, versionAuthor, versionNotes } = params;

  const subject = `📦 New version ready for review${itemTitle ? ` — ${itemTitle}` : ''}`;
  const headline = 'Ready for your review';

  const notesBlock = versionNotes
    ? `
      <p style="margin:16px 0 4px;color:#6b7280;font-size:13px;">${escapeHtml(versionAuthor || companyName)} wrote:</p>
      <div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 14px;margin:0 0 16px;border-radius:4px;">
        <p style="margin:0;color:#6b7280;font-size:14px;">${escapeHtml(versionNotes)}</p>
      </div>
    `
    : '';

  const body = `
    <p>${escapeHtml(versionAuthor || companyName)} uploaded a new version of <strong>"${escapeHtml(itemTitle || 'an item')}"</strong> in <strong>"${escapeHtml(projectTitle)}"</strong>.</p>
    ${notesBlock}
    <p style="color:#6b7280;font-size:14px;">Open the project to take a look and leave feedback.</p>
  `;

  return {
    subject,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#043946;padding:20px 32px;"><span style="color:#ffffff;font-weight:700;font-size:16px;">${escapeHtml(companyName)}</span></td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
          <div style="color:#6b7280;font-size:15px;line-height:1.6;">${body}</div>
          <div style="margin-top:28px;">
            <a href="${reviewUrl}" style="display:inline-block;background:#017C87;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Review the new version</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}
