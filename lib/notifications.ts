// lib/notifications.ts
// Orchestrator — routes events to team/client emails and webhooks.

import { createServiceClient } from './supabase-server';
import { getResend, FROM_EMAIL } from './resend';
import { buildProposalUrl } from './proposal-url';
import type { EventType, NotifyPayload } from './notification-types';
import { PREF_MAP } from './notification-types';
import { buildTeamEmail, buildClientEmail } from './notification-emails';
import { fireWebhooks } from './notification-webhooks';

// Re-export so existing consumers keep working
export type { WebhookPayload } from './notification-types';
export { fireWebhooks } from './notification-webhooks';

/* ─── Main entry point ───────────────────────────────────────────────────── */

export async function sendNotifications(payload: NotifyPayload) {
  const supabase = createServiceClient();
  const {
    event_type, share_token, comment_id, comment_author, comment_content,
    resolved_by, author_type = 'client', feedback_text, feedback_by,
  } = payload;

  // 1. Look up the proposal by share_token
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, title, client_name, client_email, crm_identifier, share_token, company_id')
    .eq('share_token', share_token)
    .single();

  if (proposalError || !proposal) {
    return { error: 'Proposal not found' };
  }

  // 2. Look up company info
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

  // 3. Route notifications
  let teamSent = 0;
  let clientSent = 0;

  if (author_type === 'team' && (event_type === 'comment_added' || event_type === 'comment_resolved')) {
    clientSent = await notifyClient({
      supabase, proposal, companyName, viewerUrl, event_type,
      comment_author, comment_content, resolved_by,
    });
  } else {
    teamSent = await notifyTeamMembers({
      supabase, proposal, viewerUrl, dashboardUrl, event_type,
      comment_id, comment_author, comment_content, resolved_by,
      feedback_text, feedback_by,
    });
  }

  // 4. Fire webhooks
  try {
    await fireWebhooks({
      event_type,
      company_id: proposal.company_id,
      custom_domain: verifiedDomain,
      proposal: {
        id:              proposal.id,
        title:           proposal.title,
        client_name:     proposal.client_name,
        client_email:    proposal.client_email || null,
        crm_identifier:  proposal.crm_identifier || null,
        share_token:     proposal.share_token,
      },
      comment_id,
      comment_author,
      comment_content,
      resolved_by,
      feedback_text,
      feedback_by,
    });
  } catch (err) {
    console.error('Webhook dispatch error:', err);
  }

  return { sent: teamSent + clientSent, team_sent: teamSent, client_sent: clientSent };
}

/* ─── Notify team members ────────────────────────────────────────────────── */

interface TeamNotifyParams {
  supabase:         ReturnType<typeof createServiceClient>;
  proposal:         { id: string; title: string; client_name: string; share_token: string; company_id: string };
  viewerUrl:        string;
  dashboardUrl:     string;
  event_type:       EventType;
  comment_id?:      string;
  comment_author?:  string;
  comment_content?: string;
  resolved_by?:     string;
  feedback_text?:   string;
  feedback_by?:     string;
}

async function notifyTeamMembers(params: TeamNotifyParams): Promise<number> {
  const {
    supabase, proposal, viewerUrl, dashboardUrl, event_type,
    comment_id, comment_author, comment_content, resolved_by,
    feedback_text, feedback_by,
  } = params;

  const prefColumn = PREF_MAP[event_type];
  if (!prefColumn) return 0; // webhook-only events (e.g. proposal_sent)

  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, email')
    .eq('company_id', proposal.company_id)
    .eq(prefColumn, true);

  if (!members || members.length === 0) return 0;

  // Deduplication
  let eventRef: string;
  if (event_type === 'proposal_viewed')              eventRef = 'first_view';
  else if (event_type === 'proposal_accepted')       eventRef = 'accepted';
  else if (event_type === 'proposal_declined')       eventRef = 'declined';
  else if (event_type === 'proposal_revision_requested') eventRef = 'revision_requested';
  else                                                eventRef = comment_id || `${event_type}_${Date.now()}`;

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
    proposalTitle:  proposal.title,
    clientName:     proposal.client_name,
    viewerUrl,
    dashboardUrl,
    commentAuthor:  comment_author,
    commentContent: comment_content,
    resolvedBy:     resolved_by,
    feedbackText:   feedback_text,
    feedbackBy:     feedback_by,
  });

  let sent = 0;
  for (const member of toNotify) {
    try {
      await getResend().emails.send({ from: FROM_EMAIL, to: member.email, subject, html });

      await supabase.from('notification_log').insert({
        proposal_id:    proposal.id,
        team_member_id: member.id,
        event_type,
        event_ref:      eventRef,
        company_id:     proposal.company_id,
      });

      sent++;
    } catch (err) {
      console.error(`Failed to notify ${member.email}:`, err);
    }
  }

  return sent;
}

/* ─── Notify client ──────────────────────────────────────────────────────── */

interface ClientNotifyParams {
  supabase:         ReturnType<typeof createServiceClient>;
  proposal:         { id: string; title: string; client_name: string; client_email: string | null; share_token: string; company_id: string };
  companyName:      string;
  viewerUrl:        string;
  event_type:       EventType;
  comment_author?:  string;
  comment_content?: string;
  resolved_by?:     string;
}

async function notifyClient(params: ClientNotifyParams): Promise<number> {
  const { supabase, proposal, companyName, viewerUrl, event_type, comment_author, comment_content, resolved_by } = params;

  if (!proposal.client_email) return 0;

  const { subject, html } = buildClientEmail({
    event_type, proposalTitle: proposal.title, companyName, viewerUrl,
    commentAuthor: comment_author, commentContent: comment_content, resolvedBy: resolved_by,
  });

  try {
    await getResend().emails.send({ from: FROM_EMAIL, to: proposal.client_email, subject, html });

    try {
      await supabase.from('notification_log').insert({
        proposal_id:    proposal.id,
        team_member_id: null as unknown as string,
        event_type:     `client_${event_type}`,
        event_ref:      `${event_type}_${Date.now()}`,
        company_id:     proposal.company_id,
      });
    } catch { /* Non-critical */ }

    return 1;
  } catch (err) {
    console.error(`Failed to notify client ${proposal.client_email}:`, err);
    return 0;
  }
}
