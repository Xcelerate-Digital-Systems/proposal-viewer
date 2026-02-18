import { createServiceClient } from './supabase-server';
import { getResend, FROM_EMAIL } from './resend';

type EventType = 'proposal_viewed' | 'proposal_accepted' | 'comment_added' | 'comment_resolved';

// Maps event_type to the team_member column that controls it
const PREF_MAP: Record<EventType, string> = {
  proposal_viewed: 'notify_proposal_viewed',
  proposal_accepted: 'notify_proposal_accepted',
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
}

export async function sendNotifications(payload: NotifyPayload) {
  const supabase = createServiceClient();
  const { event_type, share_token, comment_id, comment_author, comment_content, resolved_by } = payload;

  // 1. Look up the proposal by share_token
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, title, client_name, share_token')
    .eq('share_token', share_token)
    .single();

  if (proposalError || !proposal) {
    return { error: 'Proposal not found' };
  }

  // 2. Find team members who have this notification enabled
  const prefColumn = PREF_MAP[event_type];
  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, email')
    .eq(prefColumn, true);

  if (!members || members.length === 0) {
    return { sent: 0, reason: 'No team members with this notification enabled' };
  }

  // 3. Determine the event_ref for deduplication (always non-null)
  let eventRef: string;
  if (event_type === 'proposal_viewed') eventRef = 'first_view';
  else if (event_type === 'proposal_accepted') eventRef = 'accepted';
  else eventRef = comment_id || `${event_type}_${Date.now()}`;

  // 4. Check which members haven't been notified yet
  const { data: existingLogs } = await supabase
    .from('notification_log')
    .select('team_member_id')
    .eq('proposal_id', proposal.id)
    .eq('event_type', event_type)
    .eq('event_ref', eventRef);

  const alreadyNotified = new Set((existingLogs || []).map((l) => l.team_member_id));
  const toNotify = members.filter((m) => !alreadyNotified.has(m.id));

  if (toNotify.length === 0) {
    return { sent: 0, reason: 'All eligible members already notified' };
  }

  // 5. Build the email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const viewerUrl = `${appUrl}/view/${proposal.share_token}`;
  const dashboardUrl = appUrl;

  const { subject, html } = buildEmail({
    event_type,
    proposalTitle: proposal.title,
    clientName: proposal.client_name,
    viewerUrl,
    dashboardUrl,
    commentAuthor: comment_author,
    commentContent: comment_content,
    resolvedBy: resolved_by,
  });

  // 6. Send emails and log
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
      });

      sent++;
    } catch (err) {
      console.error(`Failed to notify ${member.email}:`, err);
    }
  }

  return { sent };
}

// --- Email templates ---

interface EmailParams {
  event_type: EventType;
  proposalTitle: string;
  clientName: string;
  viewerUrl: string;
  dashboardUrl: string;
  commentAuthor?: string;
  commentContent?: string;
  resolvedBy?: string;
}

function buildEmail(params: EmailParams): { subject: string; html: string } {
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
        <div style="background:#1a1a1a;border-left:3px solid #ff6700;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="margin:0;color:#ccc;">${escapeHtml(commentContent || '')}</p>
        </div>
      `;
      break;

    case 'comment_resolved':
      subject = `✔️ Comment resolved on "${proposalTitle}"`;
      headline = 'Comment Resolved';
      body = `<p><strong>${resolvedBy || 'Someone'}</strong> resolved a comment on <strong>"${proposalTitle}"</strong>.</p>`;
      break;
  }

  const html = emailTemplate(headline, body, viewerUrl, dashboardUrl);
  return { subject, html };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailTemplate(headline: string, body: string, viewerUrl: string, dashboardUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;padding:20px 32px;border-bottom:1px solid #2a2a2a;">
              <span style="color:#ff6700;font-weight:700;font-size:16px;">Xcelerate Digital</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:600;">${headline}</h1>
              <div style="color:#999;font-size:15px;line-height:1.6;">
                ${body}
              </div>
              <div style="margin-top:28px;">
                <a href="${viewerUrl}" style="display:inline-block;background:#ff6700;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;margin-right:8px;">
                  View Proposal
                </a>
                <a href="${dashboardUrl}" style="display:inline-block;background:#1a1a1a;color:#999;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;border:1px solid #2a2a2a;">
                  Dashboard
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;color:#555;font-size:12px;">You can manage notification preferences in your <a href="${dashboardUrl}/settings" style="color:#ff6700;text-decoration:none;">settings</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}