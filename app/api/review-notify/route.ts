// app/api/review-notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getResend, FROM_EMAIL } from '@/lib/resend';
import { buildReviewUrl } from '@/lib/proposal-url';
import crypto from 'crypto';
import { isValidWebhookUrl } from '@/lib/sanitize';

type ReviewEventType = 'review_comment_added' | 'review_comment_resolved' | 'review_item_approved' | 'review_item_revision_needed';

// Maps review event_type to team_member notification preference column
const PREF_MAP: Record<ReviewEventType, string> = {
  review_comment_added: 'notify_review_comment_added',
  review_comment_resolved: 'notify_review_comment_added',
  review_item_approved: 'notify_review_item_status',
  review_item_revision_needed: 'notify_review_item_status',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      event_type,
      share_token,
      review_item_id,
      comment_author,
      comment_content,
      resolved_by,
      item_title,
      author_type = 'client',
    } = body;

    if (!event_type || !share_token) {
      return NextResponse.json({ error: 'Missing event_type or share_token' }, { status: 400 });
    }

    const validEvents: ReviewEventType[] = [
      'review_comment_added', 'review_comment_resolved',
      'review_item_approved', 'review_item_revision_needed',
    ];
    if (!validEvents.includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up review project by share token
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, title, client_name, client_email, company_id, share_token')
      .eq('share_token', share_token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Review project not found' }, { status: 404 });
    }

    // Get company info
    const { data: company } = await supabase
      .from('companies')
      .select('name, custom_domain, domain_verified')
      .eq('id', project.company_id)
      .single();

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const verifiedDomain = company?.domain_verified ? company.custom_domain : null;
    const reviewUrl = buildReviewUrl(project.share_token, verifiedDomain, appUrl);
    const companyName = company?.name || 'Your agency';

    let teamSent = 0;
    let clientSent = 0;

    if (author_type === 'team' && (event_type === 'review_comment_added' || event_type === 'review_comment_resolved')) {
      // Team member acted → notify client
      clientSent = await notifyReviewClient({
        supabase, project, companyName, reviewUrl, event_type,
        comment_author, comment_content, resolved_by, item_title,
      });
    } else {
      // Client acted → notify team
      teamSent = await notifyReviewTeam({
        supabase, project, reviewUrl, appUrl, event_type,
        comment_author, comment_content, resolved_by, item_title,
      });
    }

    // Fire webhooks
    try {
      await fireReviewWebhooks({
        event_type, company_id: project.company_id, custom_domain: verifiedDomain,
        project: { id: project.id, title: project.title, client_name: project.client_name, share_token: project.share_token },
        review_item_id, comment_author, comment_content, resolved_by, item_title,
      });
    } catch (err) {
      console.error('Review webhook dispatch error:', err);
    }

    return NextResponse.json({ sent: teamSent + clientSent, team_sent: teamSent, client_sent: clientSent });
  } catch (err) {
    console.error('Review notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- Notify team members ---

async function notifyReviewTeam(params: {
  supabase: ReturnType<typeof createServiceClient>;
  project: { id: string; title: string; client_name: string; company_id: string };
  reviewUrl: string;
  appUrl: string;
  event_type: ReviewEventType;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
  item_title?: string;
}): Promise<number> {
  const { supabase, project, reviewUrl, appUrl, event_type, comment_author, comment_content, resolved_by, item_title } = params;

  const prefColumn = PREF_MAP[event_type];
  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, email')
    .eq('company_id', project.company_id)
    .eq(prefColumn, true);

  if (!members || members.length === 0) return 0;

  const { subject, html } = buildReviewTeamEmail({
    event_type, projectTitle: project.title, clientName: project.client_name,
    reviewUrl, dashboardUrl: appUrl, commentAuthor: comment_author,
    commentContent: comment_content, resolvedBy: resolved_by, itemTitle: item_title,
  });

  let sent = 0;
  for (const member of members) {
    try {
      await getResend().emails.send({ from: FROM_EMAIL, to: member.email, subject, html });

      await supabase.from('notification_log').insert({
        team_member_id: member.id,
        event_type,
        event_ref: `${event_type}_${Date.now()}`,
        company_id: project.company_id,
        review_project_id: project.id,
      });

      sent++;
    } catch (err) {
      console.error(`Failed to notify ${member.email}:`, err);
    }
  }

  return sent;
}

// --- Notify client ---

async function notifyReviewClient(params: {
  supabase: ReturnType<typeof createServiceClient>;
  project: { id: string; title: string; client_name: string; client_email: string | null; company_id: string };
  companyName: string;
  reviewUrl: string;
  event_type: ReviewEventType;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
  item_title?: string;
}): Promise<number> {
  const { supabase, project, companyName, reviewUrl, event_type, comment_author, comment_content, resolved_by, item_title } = params;

  if (!project.client_email) return 0;

  const { subject, html } = buildReviewClientEmail({
    event_type, projectTitle: project.title, companyName, reviewUrl,
    commentAuthor: comment_author, commentContent: comment_content,
    resolvedBy: resolved_by, itemTitle: item_title,
  });

  try {
    await getResend().emails.send({ from: FROM_EMAIL, to: project.client_email, subject, html });

    await supabase.from('notification_log').insert({
      team_member_id: null as unknown as string,
      event_type: `client_${event_type}`,
      event_ref: `${event_type}_${Date.now()}`,
      company_id: project.company_id,
      review_project_id: project.id,
    });

    return 1;
  } catch (err) {
    console.error(`Failed to notify client ${project.client_email}:`, err);
    return 0;
  }
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
  const { event_type, projectTitle, clientName, reviewUrl, dashboardUrl, commentAuthor, commentContent, resolvedBy, itemTitle } = params;

  let subject = '';
  let headline = '';
  let body = '';
  const itemRef = itemTitle ? ` on "${escapeHtml(itemTitle)}"` : '';

  switch (event_type) {
    case 'review_comment_added':
      subject = `💬 New review comment on "${projectTitle}"`;
      headline = 'New Review Comment';
      body = `
        <p><strong>${escapeHtml(commentAuthor || 'Someone')}</strong> commented${itemRef} in <strong>"${escapeHtml(projectTitle)}"</strong>:</p>
        <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
        </div>
      `;
      break;

    case 'review_comment_resolved':
      subject = `✔️ Review comment resolved on "${projectTitle}"`;
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
            <a href="${reviewUrl}" style="display:inline-block;background:#017C87;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;margin-right:8px;">View Review</a>
            <a href="${dashboardUrl}/reviews" style="display:inline-block;background:#f9fafb;color:#6b7280;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;border:1px solid #e5e7eb;">Dashboard</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Manage notifications in your <a href="${dashboardUrl}/settings" style="color:#017C87;text-decoration:none;">settings</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

function buildReviewClientEmail(params: {
  event_type: ReviewEventType;
  projectTitle: string;
  companyName: string;
  reviewUrl: string;
  commentAuthor?: string;
  commentContent?: string;
  resolvedBy?: string;
  itemTitle?: string;
}): { subject: string; html: string } {
  const { event_type, projectTitle, companyName, reviewUrl, commentAuthor, commentContent, resolvedBy, itemTitle } = params;

  let subject = '';
  let headline = '';
  let body = '';

  switch (event_type) {
    case 'review_comment_added':
      subject = `💬 ${companyName} commented on your review`;
      headline = 'New Comment on Your Review';
      body = `
        <p><strong>${escapeHtml(commentAuthor || companyName)}</strong> left feedback${itemTitle ? ` on "${escapeHtml(itemTitle)}"` : ''}:</p>
        <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
        </div>
      `;
      break;

    case 'review_comment_resolved':
      subject = `✔️ ${companyName} resolved a comment`;
      headline = 'Comment Resolved';
      body = `<p><strong>${escapeHtml(resolvedBy || companyName)}</strong> resolved a comment${itemTitle ? ` on "${escapeHtml(itemTitle)}"` : ''} in your review.</p>`;
      break;

    default:
      subject = `Update on your review from ${companyName}`;
      headline = 'Review Update';
      body = `<p>There's an update on your review <strong>"${escapeHtml(projectTitle)}"</strong>.</p>`;
      break;
  }

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
            <a href="${reviewUrl}" style="display:inline-block;background:#017C87;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">View Review</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Sent by ${escapeHtml(companyName)} via AgencyViz.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}