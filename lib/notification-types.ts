// lib/notification-types.ts
// Shared types and constants for the notification system.

export type EventType =
  | 'proposal_viewed'
  | 'proposal_accepted'
  | 'proposal_sent'
  | 'proposal_declined'
  | 'proposal_revision_requested'
  | 'comment_added'
  | 'comment_resolved';

export type AuthorType = 'team' | 'client';

// Maps event_type to the team_member column that controls it.
// Decline and revision reuse the accepted preference for now — agencies
// that want acceptance alerts almost certainly want rejection/revision ones too.
export const PREF_MAP: Record<EventType, string> = {
  proposal_viewed:              'notify_proposal_viewed',
  proposal_accepted:            'notify_proposal_accepted',
  proposal_sent:                '',  // webhook-only; no team email preference
  proposal_declined:            'notify_proposal_accepted',
  proposal_revision_requested:  'notify_proposal_accepted',
  comment_added:                'notify_comment_added',
  comment_resolved:             'notify_comment_resolved',
};

export interface NotifyPayload {
  event_type:       EventType;
  share_token:      string;
  comment_id?:      string;
  comment_author?:  string;
  comment_content?: string;
  resolved_by?:     string;
  author_type?:     AuthorType;
  feedback_text?:   string;
  feedback_by?:     string;
}

export interface WebhookPayload {
  event_type:      EventType;
  company_id:      string;
  custom_domain?:  string | null;
  proposal: {
    id:             string;
    title:          string;
    client_name:    string;
    client_email:   string | null;
    crm_identifier: string | null;
    share_token:    string;
  };
  comment_id?:      string;
  comment_author?:  string;
  comment_content?: string;
  resolved_by?:     string;
  feedback_text?:   string;
  feedback_by?:     string;
}
