// lib/types/feedback.ts
//
// Types for the Creative Feedback tool (whiteboard + pin comments + annotations).
//
// NOTE: DB tables are still named `review_*` (review_projects, review_items,
// review_comments, review_board_edges, review_board_notes) for historical reasons.
// These TS types map 1:1 to those rows — only the application-layer naming was
// flipped to "Feedback" to free up "Review" for a separate upcoming feature.

export type FeedbackShareMode = 'list' | 'board';

export type FeedbackProject = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  client_email: string | null;
  status: FeedbackStatus;
  share_token: string;
  board_share_token: string | null;
  share_mode: FeedbackShareMode;
  root_domain: string | null;
  script_installed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FeedbackItemType =
  | 'webpage'
  | 'email'
  | 'ad'
  | 'image'
  | 'video'
  | 'sms'
  | 'google_ad'
  | 'pdf';

/** Workflow status, applied to both projects and items. String values are DB-bound. */
export type FeedbackStatus =
  | 'draft'
  | 'internal_review'
  | 'external_review'
  | 'client_review'
  | 'revisions_completed'
  | 'approved'
  | 'archived';

/** @deprecated Use `FeedbackStatus`. */
export type FeedbackItemStatus = FeedbackStatus;

export type GoogleAdFormat = 'search' | 'display';

export type FeedbackItem = {
  id: string;
  review_project_id: string;
  company_id: string;
  title: string;
  type: FeedbackItemType;
  sort_order: number;
  url: string | null;
  screenshot_url: string | null;
  html_content: string | null;
  // Meta ad fields
  ad_headline: string | null;
  ad_copy: string | null;
  ad_cta: string | null;
  ad_creative_url: string | null;
  ad_platform: string | null;
  // Email fields
  email_subject: string | null;
  email_preheader: string | null;
  email_body: string | null;
  // SMS fields
  sms_body: string | null;
  // Image/media fields
  image_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  // Google Ad fields
  google_ad_format: GoogleAdFormat | null;
  google_ad_headline: string | null;
  google_ad_description1: string | null;
  google_ad_description2: string | null;
  google_ad_display_url: string | null;
  google_ad_final_url: string | null;
  // Meta
  status: FeedbackStatus;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  widget_installed_at: string | null;
  prefer_screenshot: boolean;
  board_x: number | null;
  board_y: number | null;
  share_token: string | null;
};

export type FeedbackCommentType = 'pin' | 'text_highlight' | 'general';

export type FeedbackComment = {
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
  comment_type: FeedbackCommentType;
  pin_x: number | null;
  pin_y: number | null;
  highlight_start: number | null;
  highlight_end: number | null;
  highlight_text: string | null;
  highlight_element_path: string | null;
  annotation_data: Record<string, unknown> | null;
  attachments: FeedbackCommentAttachment[];
  screenshot_url: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FeedbackCommentAttachment = {
  url: string;
  name: string;
  type: string;
  size: number;
};

export type FeedbackCommentReaction = {
  id: string;
  review_comment_id: string;
  emoji: string;
  author_name: string;
  author_user_id: string | null;
  created_at: string;
};

// ─── Board / Whiteboard types ─────────────────────────────────────────────────

export type FeedbackBoardEdge = {
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

export type FeedbackBoardNote = {
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

export type FeedbackShapeType = 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text';

export type FeedbackBoardShape = {
  id: string;
  review_project_id: string;
  company_id: string;
  shape_type: FeedbackShapeType;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  end_x: number | null;
  end_y: number | null;
  content: string | null;
  color: string;
  stroke_width: number;
  dashed: boolean;
  font_size: number | null;
  created_at: string;
  updated_at: string;
};

