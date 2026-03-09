// lib/notifications.ts
import { createServiceClient } from './supabase-server';
import { getResend, FROM_EMAIL } from './resend';
import { buildProposalUrl } from './proposal-url';
import crypto from 'crypto';

type EventType = 'proposal_viewed' | 'proposal_accepted' | 'proposal_sent' | 'comment_added' | 'comment_resolved';
type AuthorType = 'team' | 'client';

// Maps event_type to the team_member column that controls it
const PREF_MAP: Record<EventType, string> = {
  proposal_viewed: 'notify_proposal_viewed',
  proposal_accepted: 'notify_proposal_accepted',
  proposal_sent: '',           // webhook-only; no team email preference
  comment_added: 'notify_comment_added',
  comment_resolved: 'notify_comment_resolved',
};

interface NotifyPayload {
  event_type: EventType;
  share_token: string;           // validates the request
  comment_id?: string;           // for comment events
  comment_author?: string;       // who left the comment
  comment_content?: string;      // the comment text
  resolved_by?: string;          // who resolved the comment
  author_type?: AuthorType;      // 'team' = notify client, 'client' = notify team
}

export async function sendNotifications(payload: NotifyPayload) {
  const supabase = createServiceClient();
  const { event_type, share_token, comment_id, comment_author, comment_content, resolved_by, author_type = 'client' } = payload;

  // 1. Look up the proposal by share_token
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, title, client_name, client_email, crm_identifier, share_token, company_id')
    .eq('share_token', share_token)
    .single();

  if (proposalError || !proposal) {
    return { error: 'Proposal not found' };
  }

  // 2. Look up company info for branding and custom domain
  const { data: company } = await supabase
    .from('companies')
    .select('name, custom_domain, domain_verified')
    .eq('id', proposal.company_id)
    .single();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const verifiedDomain = company?.domain_verified ? company.custom_domain : null;
  const viewerUrl = buildProposalUrl(proposal.share_token, verifiedDomain, appUrl);
  const dashboardUrl = appUrl;
  const companyName = company?.name || 'Your agency';

  // 3. Route notifications based on who performed the action
  let teamSent = 0;
  let clientSent = 0;

  if (author_type === 'team' && (event_type === 'comment_added' || event_type === 'comment_resolved')) {
    // Team member acted → notify the client via email
    clientSent = await notifyClient({
      supabase,
      proposal,
      companyName,
      viewerUrl,
      event_type,
      comment_author,
      comment_content,
      resolved_by,
    });
  } else {
    // Client acted (or non-comment events like viewed/accepted) → notify team members
    teamSent = await notifyTeamMembers({
      supabase,
      proposal,
      viewerUrl,
      dashboardUrl,
      event_type,
      comment_id,
      comment_author,
      comment_content,
      resolved_by,
    });
  }

  // 4. Fire webhooks — await to ensure they complete before serverless function exits
  try {
    await fireWebhooks({
      event_type,
      company_id: proposal.company_id,
      custom_domain: verifiedDomain,
      proposal: {
        id: proposal.id,
        title: proposal.title,
        client_name: proposal.client_name,
        client_email: proposal.client_email || null,
        crm_identifier: proposal.crm_identifier || null,
        share_token: proposal.share_token,
      },
      comment_id,
      comment_author,
      comment_content,
      resolved_by,
    });
  } catch (err) {
    console.error('Webhook dispatch error:', err);
  }

  return { sent: teamSent + clientSent, team_sent: teamSent, client_sent: clientSent };
}

// --- Notify team members (existing behavior) ---

interface TeamNotifyParams {
  supabase: ReturnType<typeof createServiceClient>;
  proposal: { id: string; title: string; client_name: string; share_token: string; company_id: string };
  viewerUrl: string;
  dashboardUrl: string;
  event_type: EventType;
  comment_id?: string;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
}

async function notifyTeamMembers(params: TeamNotifyParams): Promise<number> {
  const { supabase, proposal, viewerUrl, dashboardUrl, event_type, comment_id, comment_author, comment_content, resolved_by } = params;

  const prefColumn = PREF_MAP[event_type];
  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, email')
    .eq('company_id', proposal.company_id)
    .eq(prefColumn, true);

  if (!members || members.length === 0) {
    return 0;
  }

  // Deduplication
  let eventRef: string;
  if (event_type === 'proposal_viewed') eventRef = 'first_view';
  else if (event_type === 'proposal_accepted') eventRef = 'accepted';
  else eventRef = comment_id || `${event_type}_${Date.now()}`;

  const { data: existingLogs } = await supabase
    .from('notification_log')
    .select('team_member_id')
    .eq('proposal_id', proposal.id)
    .eq('event_type', event_type)
    .eq('event_ref', eventRef);

  const alreadyNotified = new Set((existingLogs || []).map((l) => l.team_member_id));
  const toNotify = members.filter((m) => !alreadyNotified.has(m.id));

  if (toNotify.length === 0) return 0;

  const { subject, html } = buildTeamEmail({
    event_type,
    proposalTitle: proposal.title,
    clientName: proposal.client_name,
    viewerUrl,
    dashboardUrl,
    commentAuthor: comment_author,
    commentContent: comment_content,
    resolvedBy: resolved_by,
  });

  let sent = 0;
  for (const member of toNotify) {
    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: member.email,
        subject,
        html,
      });

      await supabase.from('notification_log').insert({
        proposal_id: proposal.id,
        team_member_id: member.id,
        event_type,
        event_ref: eventRef,
        company_id: proposal.company_id,
      });

      sent++;
    } catch (err) {
      console.error(`Failed to notify ${member.email}:`, err);
    }
  }

  return sent;
}

// --- Notify client ---

interface ClientNotifyParams {
  supabase: ReturnType<typeof createServiceClient>;
  proposal: { id: string; title: string; client_name: string; client_email: string | null; share_token: string; company_id: string };
  companyName: string;
  viewerUrl: string;
  event_type: EventType;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
}

async function notifyClient(params: ClientNotifyParams): Promise<number> {
  const { supabase, proposal, companyName, viewerUrl, event_type, comment_author, comment_content, resolved_by } = params;

  // No client email → can't notify
  if (!proposal.client_email) {
    return 0;
  }

  const { subject, html } = buildClientEmail({
    event_type,
    proposalTitle: proposal.title,
    companyName,
    viewerUrl,
    commentAuthor: comment_author,
    commentContent: comment_content,
    resolvedBy: resolved_by,
  });

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: proposal.client_email,
      subject,
      html,
    });

    // Log for dedup (non-critical)
    try {
      await supabase.from('notification_log').insert({
        proposal_id: proposal.id,
        team_member_id: null as unknown as string,
        event_type: `client_${event_type}`,
        event_ref: `${event_type}_${Date.now()}`,
        company_id: proposal.company_id,
      });
    } catch {
      // Non-critical
    }

    return 1;
  } catch (err) {
    console.error(`Failed to notify client ${proposal.client_email}:`, err);
    return 0;
  }
}

// --- Webhook dispatch ---

export interface WebhookPayload {
  event_type: EventType;
  company_id: string;
  custom_domain?: string | null;
  proposal: {
    id: string;
    title: string;
    client_name: string;
    client_email: string | null;
    crm_identifier: string | null;
    share_token: string;
  };
  comment_id?: string;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
}

export async function fireWebhooks(payload: WebhookPayload) {
  const supabase = createServiceClient();
  const { event_type, company_id, custom_domain } = payload;

  // Query webhook_endpoints table — each row is one URL for one event_type
  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('company_id', company_id)
    .eq('enabled', true)
    .eq('event_type', event_type);

  if (!webhooks || webhooks.length === 0) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const body = JSON.stringify({
    event: event_type,
    timestamp: new Date().toISOString(),
    proposal: {
      id: payload.proposal.id,
      title: payload.proposal.title,
      client_name: payload.proposal.client_name,
      client_email: payload.proposal.client_email,
      crm_identifier: payload.proposal.crm_identifier,
      viewer_url: buildProposalUrl(payload.proposal.share_token, custom_domain, appUrl),
    },
    ...(payload.comment_id && {
      comment: {
        id: payload.comment_id,
        author: payload.comment_author,
        content: payload.comment_content,
      },
    }),
    ...(payload.resolved_by && { resolved_by: payload.resolved_by }),
  });

  for (const webhook of webhooks) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AgencyViz-Webhooks/1.0',
      };

      // HMAC-SHA256 signature if secret is set
      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(body)
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
    } catch (err) {
      console.error(`Webhook failed for ${webhook.url}:`, err);
    }
  }
}

// --- Team email templates (existing) ---

interface TeamEmailParams {
  event_type: EventType;
  proposalTitle: string;
  clientName: string;
  viewerUrl: string;
  dashboardUrl: string;
  commentAuthor?: string;
  commentContent?: string;
  resolvedBy?: string;
}

function buildTeamEmail(params: TeamEmailParams): { subject: string; html: string } {
  const { event_type, proposalTitle, clientName, viewerUrl, dashboardUrl, commentAuthor, commentContent, resolvedBy } = params;

  let subject = '';
  let headline = '';
  let body = '';

  switch (event_type) {
    case 'proposal_viewed':
      subject = `📋 ${clientName} viewed "${proposalTitle}"`;
      headline = 'Proposal Viewed';
      body = `<p><strong>${clientName}</strong> just opened your proposal <strong>"${proposalTitle}"</strong> for the first time.</p>`;
      break;

    case 'proposal_accepted':
      subject = `✅ ${clientName} accepted "${proposalTitle}"`;
      headline = 'Proposal Accepted!';
      body = `<p><strong>${clientName}</strong> has accepted your proposal <strong>"${proposalTitle}"</strong>.</p>`;
      break;

    case 'comment_added':
      subject = `💬 New comment on "${proposalTitle}"`;
      headline = 'New Comment';
      body = `
        <p><strong>${commentAuthor || 'Someone'}</strong> left a comment on <strong>"${proposalTitle}"</strong>:</p>
        <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
        </div>
      `;
      break;

    case 'comment_resolved':
      subject = `✔️ Comment resolved on "${proposalTitle}"`;
      headline = 'Comment Resolved';
      body = `<p><strong>${resolvedBy || 'Someone'}</strong> resolved a comment on <strong>"${proposalTitle}"</strong>.</p>`;
      break;
  }

  const html = teamEmailTemplate(headline, body, viewerUrl, dashboardUrl);
  return { subject, html };
}

// --- Client email templates (new) ---

interface ClientEmailParams {
  event_type: EventType;
  proposalTitle: string;
  companyName: string;
  viewerUrl: string;
  commentAuthor?: string;
  commentContent?: string;
  resolvedBy?: string;
}

function buildClientEmail(params: ClientEmailParams): { subject: string; html: string } {
  const { event_type, proposalTitle, companyName, viewerUrl, commentAuthor, commentContent, resolvedBy } = params;

  let subject = '';
  let headline = '';
  let body = '';

  switch (event_type) {
    case 'comment_added':
      subject = `💬 ${companyName} commented on your proposal`;
      headline = 'New Comment on Your Proposal';
      body = `
        <p><strong>${commentAuthor || companyName}</strong> left a comment on <strong>"${proposalTitle}"</strong>:</p>
        <div style="background:#f3fafa;border-left:3px solid #017C87;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#374151;">${escapeHtml(commentContent || '')}</p>
        </div>
        <p style="color:#6b7280;">You can view the full conversation and reply directly on the proposal.</p>
      `;
      break;

    case 'comment_resolved':
      subject = `✔️ ${companyName} resolved a comment on your proposal`;
      headline = 'Comment Resolved';
      body = `
        <p><strong>${resolvedBy || companyName}</strong> resolved a comment on <strong>"${proposalTitle}"</strong>.</p>
        <p style="color:#6b7280;">Open your proposal to see the update.</p>
      `;
      break;

    default:
      // Shouldn't reach here for client notifications
      subject = `Update on "${proposalTitle}"`;
      headline = 'Proposal Update';
      body = `<p>There's an update on your proposal <strong>"${proposalTitle}"</strong>.</p>`;
      break;
  }

  const html = clientEmailTemplate(headline, body, viewerUrl, companyName);
  return { subject, html };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Email templates ---

function teamEmailTemplate(headline: string, body: string, viewerUrl: string, dashboardUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#043946;padding:20px 32px;">
              <span style="color:#ffffff;font-weight:700;font-size:16px;">AgencyViz</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">
                ${body}
              </div>
              <div style="margin-top:28px;">
                <a href="${viewerUrl}" style="display:inline-block;background:#017C87;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;margin-right:8px;">
                  View Proposal
                </a>
                <a href="${dashboardUrl}" style="display:inline-block;background:#f9fafb;color:#6b7280;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;border:1px solid #e5e7eb;">
                  Dashboard
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">You can manage notification preferences in your <a href="${dashboardUrl}/settings" style="color:#017C87;text-decoration:none;">settings</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function clientEmailTemplate(headline: string, body: string, viewerUrl: string, companyName: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#043946;padding:20px 32px;">
              <span style="color:#ffffff;font-weight:700;font-size:16px;">${escapeHtml(companyName)}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${headline}</h1>
              <div style="color:#6b7280;font-size:15px;line-height:1.6;">
                ${body}
              </div>
              <div style="margin-top:28px;">
                <a href="${viewerUrl}" style="display:inline-block;background:#017C87;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
                  View Proposal
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">This email was sent by ${escapeHtml(companyName)} via AgencyViz.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}