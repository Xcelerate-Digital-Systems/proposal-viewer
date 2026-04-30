// lib/types/feedback.ts
//
// Types for the Creative Feedback tool (whiteboard + pin comments + annotations).
//
// NOTE: DB tables are still named `review_*` (review_projects, review_items,
// review_comments, review_board_edges, review_board_notes) for historical reasons.
// These TS types map 1:1 to those rows — only the application-layer naming was
// flipped to "Feedback" to free up "Review" for a separate upcoming feature.

export type FeedbackShareMode = 'list' | 'board';

/** Which tabs the public project share link exposes. */
export type FeedbackSharedViews = {
  board: boolean;
  kanban: boolean;
  items: boolean;
};

export const DEFAULT_SHARED_VIEWS: FeedbackSharedViews = {
  board: true,
  kanban: false,
  items: true,
};

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
  shared_views: FeedbackSharedViews;
  root_domain: string | null;
  script_installed_at: string | null;
  reviewer_note: string | null;
  reviewer_note_show: boolean;
  reviewer_note_updated_at: string | null;
  pause_new_comments: boolean;
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
  | 'pdf'
  | 'meta_lead_form';

export type MetaLeadFormQuestionType =
  | 'short_answer'
  | 'email'
  | 'phone'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'city'
  | 'multiple_choice';

export type MetaLeadFormQuestion = {
  id: string;
  type: MetaLeadFormQuestionType;
  label: string;
  options?: string[];
  required?: boolean;
};

/** Shape stored in `review_items.meta_lead_form_data` (jsonb). */
export type MetaLeadFormData = {
  cover_url: string | null;
  intro_headline: string;
  intro_description: string;
  business_name: string | null;
  cta: string;
  questions: MetaLeadFormQuestion[];
  privacy_policy_url: string;
  privacy_policy_label: string;
  completion_headline: string;
  completion_description: string;
  completion_button_label: string;
  completion_url: string;
};

/** Workflow status, applied to both projects and items. String values are DB-bound. */
export type FeedbackStatus =
  | 'draft'
  | 'in_progress'
  | 'internal_review'
  | 'client_review'
  | 'revision_needed'
  | 'approved'
  | 'rejected'
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
  // Meta Lead Form (jsonb blob — see MetaLeadFormData)
  meta_lead_form_data: MetaLeadFormData | null;
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
  /** When set, the viewer renders the assets from this row in `review_item_versions`.
   *  Null means render the v1 fields already on the item itself. */
  active_version_id: string | null;
};

/** A stored version of a feedback item's assets. v1 lives on `review_items`; v2+ live here. */
export type FeedbackItemVersion = {
  id: string;
  review_item_id: string;
  company_id: string;
  version_number: number;
  notes: string | null;
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
  video_url: string | null;
  pdf_url: string | null;
  google_ad_format: GoogleAdFormat | null;
  google_ad_headline: string | null;
  google_ad_description1: string | null;
  google_ad_description2: string | null;
  google_ad_display_url: string | null;
  google_ad_final_url: string | null;
  meta_lead_form_data: MetaLeadFormData | null;
  created_at: string;
  created_by: string | null;
};

export type FeedbackCommentType = 'pin' | 'text_highlight' | 'general';

export type FeedbackCommentPriority = 'high' | 'medium' | 'low' | 'none';

export type FeedbackComment = {
  id: string;
  review_item_id: string;
  company_id: string;
  /** Which version of the item the comment was made on. Null means v1 (original). */
  version_id: string | null;
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
  video_url: string | null;
  priority: FeedbackCommentPriority;
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
  /** Set when the source is a review_item. Mutually exclusive with source_shape_id. */
  source_item_id: string | null;
  /** Set when the source is a board shape (e.g. a decision node). */
  source_shape_id: string | null;
  target_item_id: string | null;
  target_shape_id: string | null;
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

export type FeedbackShapeType =
  | 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text'
  | 'decision' | 'wait'
  | 'call' | 'meeting' | 'automation' | 'goal';

/** Stored as JSON in `review_board_shapes.content` for the label-only action
 *  shapes (Call, Meeting, Automation, Goal). Kept as an object — not a raw
 *  string — so per-type config (duration, value, tag name, …) can be added
 *  later without touching existing rows. */
export type FeedbackActionContent = {
  label: string | null;
};

/** Stored as JSON in `review_board_shapes.content` for wait shapes. */
export type FeedbackWaitUnit = 'minutes' | 'hours' | 'days' | 'weeks';
export type FeedbackWaitContent = {
  duration: number;
  unit: FeedbackWaitUnit;
  label?: string | null;
};

/**
 * Shape of the JSON blob stored in `review_board_shapes.content` for decision shapes.
 * Drawn shapes (rectangle/ellipse/arrow/line) leave content null; text shapes store raw text.
 */
export type FeedbackDecisionBranchSide = 'top' | 'right' | 'bottom' | 'left';

export type FeedbackDecisionBranch = {
  /** Stable id so edges can reference a branch across renames. */
  id: string;
  label: string;
  color: string;
  /** Which corner of the diamond the branch pill hangs off. */
  side: FeedbackDecisionBranchSide;
};
export type FeedbackDecisionContent = {
  question: string;
  branches: FeedbackDecisionBranch[];
};

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

