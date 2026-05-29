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

export interface WebhookProposalData {
  id:              string;
  title:           string;
  entity_type:     'proposal' | 'quote';
  status:          string;
  client_name:     string;
  client_email:    string | null;
  client_organisation: string | null;
  crm_identifier:  string | null;
  share_token:     string;
  quote_number:    number | null;
  valid_until:     string | null;
  created_at:      string;
  updated_at:      string;
  sent_at:         string | null;
  first_viewed_at: string | null;
  last_viewed_at:  string | null;
  accepted_at:     string | null;
  accepted_by_name: string | null;
  declined_at:     string | null;
  declined_by_name: string | null;
  decline_reason:  string | null;
  revision_requested_at: string | null;
  revision_requested_by_name: string | null;
  revision_notes:  string | null;
}

export interface WebhookPricingPage {
  id:          string;
  title:       string;
  position:    number;
  tax_enabled: boolean;
  tax_rate:    number;
  tax_label:   string;
  items: {
    id:           string;
    label:        string;
    description:  string;
    amount:       number;
    qty:          number | null;
    unit_price:   number | null;
    discount_pct: number | null;
  }[];
  optional_items: {
    id:           string;
    label:        string;
    description:  string;
    amount:       number;
    discount_pct: number | null;
  }[];
  payment_schedule: unknown | null;
  subtotal:    number;
  discount:    number;
  tax:         number;
  total:       number;
}

export interface WebhookPackagePage {
  id:         string;
  title:      string;
  position:   number;
  packages: {
    id:           string;
    name:         string;
    price:        number;
    price_prefix: string;
    price_suffix: string;
    is_recommended: boolean;
    features:     { text: string }[];
  }[];
}

export interface WebhookPayload {
  event_type:      EventType;
  company_id:      string;
  custom_domain?:  string | null;
  proposal:        WebhookProposalData;
  pricing?:        WebhookPricingPage[];
  packages?:       WebhookPackagePage[];
  comment_id?:      string;
  comment_author?:  string;
  comment_content?: string;
  resolved_by?:     string;
  feedback_text?:   string;
  feedback_by?:     string;
}
