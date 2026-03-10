// lib/types/team.ts

export type TeamMember = {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  is_super_admin: boolean;
  avatar_path: string | null;
  notify_proposal_viewed: boolean;
  notify_proposal_accepted: boolean;
  notify_comment_added: boolean;
  notify_comment_resolved: boolean;
  notify_review_comment_added: boolean;
  notify_review_item_status: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookEndpoint = {
  id: string;
  company_id: string;
  event_type:
    | 'proposal_viewed'
    | 'proposal_accepted'
    | 'comment_added'
    | 'comment_resolved'
    | 'review_comment_added'
    | 'review_comment_resolved'
    | 'review_item_approved'
    | 'review_item_revision_needed';
  url: string;
  secret: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};