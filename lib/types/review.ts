// lib/types/review.ts

// ─── Creative Review types ────────────────────────────────────────────────────

export type ReviewShareMode = 'list' | 'board';

export type ReviewProject = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  client_email: string | null;
  status: 'active' | 'archived' | 'completed';
  share_token: string;
  board_share_token: string | null;
  share_mode: ReviewShareMode;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewItemType = 'webpage' | 'email' | 'ad' | 'image' | 'video' | 'sms';
export type ReviewItemStatus = 'draft' | 'in_review' | 'approved' | 'revision_needed';

export type ReviewItem = {
  id: string;
  review_project_id: string;
  company_id: string;
  title: string;
  type: ReviewItemType;
  sort_order: number;
  url: string | null;
  screenshot_url: string | null;
  html_content: string | null;
  ad_headline: string | null;
  ad_copy: string | null;
  ad_cta: string | null;
  ad_creative_url: string | null;
  ad_platform: string | null;
  email_subject: string | null;
  email_preheader: string | null;
  email_body: string | null;
  sms_body: string | null;
  image_url: string | null;
  status: ReviewItemStatus;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  widget_installed_at: string | null;
  board_x: number | null;
  board_y: number | null;
  share_token: string | null;
};

export type ReviewCommentType = 'pin' | 'text_highlight' | 'general';

export type ReviewComment = {
  id: string;
  review_item_id: string;
  company_id: string;
  parent_comment_id: string | null;
  thread_number: number | null;
  author_name: string;
  author_email: string | null;
  author_user_id: string | null;
  author_type: 'team' | 'client';
  content: string;
  comment_type: ReviewCommentType;
  pin_x: number | null;
  pin_y: number | null;
  highlight_start: number | null;
  highlight_end: number | null;
  highlight_text: string | null;
  highlight_element_path: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Board / Whiteboard types ─────────────────────────────────────────────────

export type ReviewBoardEdge = {
  id: string;
  review_project_id: string;
  company_id: string;
  source_item_id: string;
  target_item_id: string;
  source_handle: string;
  target_handle: string;
  label: string | null;
  edge_type: string;
  animated: boolean;
  style: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ReviewBoardNote = {
  id: string;
  review_project_id: string;
  company_id: string;
  content: string;
  color: string;
  board_x: number;
  board_y: number;
  width: number | null;
  height: number | null;
  font_size: number | null;
  created_at: string;
  updated_at: string;
};