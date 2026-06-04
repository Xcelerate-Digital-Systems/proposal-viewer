// lib/notifications.ts
// Orchestrator — routes events to team/client emails and webhooks.

import { createServiceClient } from './supabase-server';
import { fromEmail } from './resend';
import { sendAndLogEmail } from './email-log';
import { buildProposalUrl } from './proposal-url';
import type { EventType, NotifyPayload } from './notification-types';
import { PREF_MAP } from './notification-types';
import { buildTeamEmail, buildClientEmail, type ProposalEmailBranding } from './notification-emails';
import { fireWebhooks } from './notification-webhooks';
import {
  insertInAppNotifications,
  resolveUserIdsForTeamMembers,
  type NotificationCategory,
} from './in-app-notifications';

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
    .select('id, title, client_name, client_email, client_organisation, crm_identifier, share_token, company_id, entity_type, status, quote_number, valid_until, created_at, updated_at, sent_at, first_viewed_at, last_viewed_at, accepted_at, accepted_by_name, declined_at, declined_by_name, decline_reason, revision_requested_at, revision_requested_by_name, revision_notes')
    .eq('share_token', share_token)
    .single();

  if (proposalError || !proposal) {
    return { error: 'Proposal not found' };
  }

  // 2. Look up company info + branding
  const { data: company } = await supabase
    .from('companies')
    .select('name, custom_domain, domain_verified, accent_color, logo_path')
    .eq('id', proposal.company_id)
    .single();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const verifiedDomain = company?.domain_verified ? company.custom_domain : null;
  const viewerUrl = buildProposalUrl(proposal.share_token, verifiedDomain, appUrl);
  const dashboardUrl = appUrl;
  const companyName = company?.name || 'Your agency';

  const logoUrl = company?.logo_path
    ? supabase.storage.from('company-assets').getPublicUrl(company.logo_path).data.publicUrl
    : null;
  const branding: ProposalEmailBranding = {
    companyName,
    accentColor: company?.accent_color || '#017C87',
    logoUrl,
  };

  // 3. Route notifications
  let teamSent = 0;
  let clientSent = 0;

  if (author_type === 'team' && (event_type === 'comment_added' || event_type === 'comment_resolved')) {
    clientSent = await notifyClient({
      supabase, proposal, companyName, branding, viewerUrl, event_type,
      comment_id, comment_author, comment_content, resolved_by,
    });
  } else {
    teamSent = await notifyTeamMembers({
      supabase, proposal, branding, viewerUrl, dashboardUrl, event_type,
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
        id:                         proposal.id,
        title:                      proposal.title,
        entity_type:                proposal.entity_type ?? 'proposal',
        status:                     proposal.status,
        client_name:                proposal.client_name,
        client_email:               proposal.client_email || null,
        client_organisation:        proposal.client_organisation || null,
        crm_identifier:             proposal.crm_identifier || null,
        share_token:                proposal.share_token,
        quote_number:               proposal.quote_number ?? null,
        valid_until:                proposal.valid_until ?? null,
        created_at:                 proposal.created_at,
        updated_at:                 proposal.updated_at,
        sent_at:                    proposal.sent_at ?? null,
        first_viewed_at:            proposal.first_viewed_at ?? null,
        last_viewed_at:             proposal.last_viewed_at ?? null,
        accepted_at:                proposal.accepted_at ?? null,
        accepted_by_name:           proposal.accepted_by_name ?? null,
        declined_at:                proposal.declined_at ?? null,
        declined_by_name:           proposal.declined_by_name ?? null,
        decline_reason:             proposal.decline_reason ?? null,
        revision_requested_at:      proposal.revision_requested_at ?? null,
        revision_requested_by_name: proposal.revision_requested_by_name ?? null,
        revision_notes:             proposal.revision_notes ?? null,
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
  branding:         ProposalEmailBranding;
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
    supabase, proposal, branding, viewerUrl, dashboardUrl, event_type,
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
    branding,
    feedbackBy:     feedback_by,
  });

  let sent = 0;
  for (const member of toNotify) {
    try {
      await sendAndLogEmail({
        from: fromEmail(branding.companyName), to: member.email, subject, html,
        companyId: proposal.company_id,
        category: 'proposal_notification',
        eventType: event_type,
        entityType: 'proposal',
        entityId: proposal.id,
      });

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

  // In-app notifications for notified team members.
  try {
    const userIds = await resolveUserIdsForTeamMembers(
      supabase,
      toNotify.map((m) => m.id),
    );
    if (userIds.length > 0) {
      const inAppCategory: NotificationCategory =
        event_type === 'proposal_viewed'   ? 'proposal_viewed'
        : event_type === 'proposal_accepted' ? 'proposal_accepted'
        : event_type === 'proposal_declined' ? 'proposal_declined'
        : event_type === 'proposal_revision_requested' ? 'proposal_revision_requested'
        : event_type === 'comment_added'    ? 'comment_added'
        : 'comment_resolved';
      await insertInAppNotifications({
        supabase,
        companyId: proposal.company_id,
        userIds,
        category: inAppCategory,
        title: subject,
        body: comment_content || feedback_text || null,
        link: `/proposals/${proposal.id}`,
      });
    }
  } catch {
    // Non-critical
  }

  return sent;
}

/* ─── Notify client ──────────────────────────────────────────────────────── */

interface ClientNotifyParams {
  supabase:         ReturnType<typeof createServiceClient>;
  proposal:         { id: string; title: string; client_name: string; client_email: string | null; share_token: string; company_id: string };
  companyName:      string;
  branding:         ProposalEmailBranding;
  viewerUrl:        string;
  event_type:       EventType;
  comment_id?:      string;
  comment_author?:  string;
  comment_content?: string;
  resolved_by?:     string;
}

async function notifyClient(params: ClientNotifyParams): Promise<number> {
  const { supabase, proposal, companyName, branding, viewerUrl, event_type, comment_id, comment_author, comment_content, resolved_by } = params;

  if (!proposal.client_email) return 0;

  const { subject, html } = buildClientEmail({
    event_type, proposalTitle: proposal.title, companyName, viewerUrl,
    commentAuthor: comment_author, commentContent: comment_content, resolvedBy: resolved_by,
    branding,
  });

  // Dedup client emails using a stable event_ref so retries don't double-send.
  // Prefer comment_id when available — content-based keys can collide when the
  // same author posts similar comments in quick succession.
  let clientEventRef: string;
  if (event_type === 'comment_added') {
    if (comment_id) {
      clientEventRef = `client_comment_${comment_id}`;
    } else {
      console.warn('sendNotifications: comment_added event without comment_id — falling back to content-based dedup key');
      clientEventRef = `client_comment_${comment_author || ''}_${(comment_content || '').slice(0, 50)}`;
    }
  } else if (event_type === 'comment_resolved') {
    clientEventRef = `client_resolved_${resolved_by || ''}`;
  } else {
    clientEventRef = `client_${event_type}`;
  }

  const { data: existingClientLog } = await supabase
    .from('notification_log')
    .select('id')
    .eq('proposal_id', proposal.id)
    .eq('event_type', `client_${event_type}`)
    .eq('event_ref', clientEventRef)
    .limit(1);

  if (existingClientLog && existingClientLog.length > 0) return 0;

  try {
    await sendAndLogEmail({
      from: fromEmail(companyName), to: proposal.client_email, subject, html,
      companyId: proposal.company_id,
      category: 'proposal_notification',
      eventType: `client_${event_type}`,
      entityType: 'proposal',
      entityId: proposal.id,
    });

    try {
      await supabase.from('notification_log').insert({
        proposal_id:    proposal.id,
        team_member_id: null as unknown as string,
        event_type:     `client_${event_type}`,
        event_ref:      clientEventRef,
        company_id:     proposal.company_id,
      });
    } catch { /* Non-critical */ }

    return 1;
  } catch (err) {
    console.error(`Failed to notify client ${proposal.client_email}:`, err);
    return 0;
  }
}
