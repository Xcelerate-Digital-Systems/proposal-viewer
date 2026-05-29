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
  client_company: string | null;
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
  due_date: string | null;
  pause_new_comments: boolean;
  widget_enabled: boolean;
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
  | 'google_search_ad'
  | 'google_banner_ad'
  | 'pdf'
  | 'meta_lead_form';

export type MetaLeadFormQuestionType =
  // Custom
  | 'short_answer'
  | 'multiple_choice'
  // Pre-fill — user info
  | 'email'
  | 'phone'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'street_address'
  | 'city'
  | 'state'
  | 'province'
  | 'country'
  | 'post_code'
  | 'date_of_birth'
  | 'gender'
  // Pre-fill — work info
  | 'company_name'
  | 'job_title'
  | 'work_email'
  | 'work_phone';

export type MetaLeadFormQuestion = {
  id: string;
  type: MetaLeadFormQuestionType;
  label: string;
  options?: string[];
  required?: boolean;
};

/** Pre-fill question types — Meta auto-fills these from the user's profile, so
 *  they render on the "Contact Info" page after custom questions. */
export const META_LEAD_FORM_PREFILL_TYPES: ReadonlyArray<MetaLeadFormQuestionType> = [
  'email', 'phone', 'full_name', 'first_name', 'last_name',
  'street_address', 'city', 'state', 'province', 'country', 'post_code',
  'date_of_birth', 'gender',
  'company_name', 'job_title', 'work_email', 'work_phone',
];

export function isMetaLeadFormPrefillType(type: MetaLeadFormQuestionType): boolean {
  return (META_LEAD_FORM_PREFILL_TYPES as ReadonlyArray<string>).includes(type);
}

/** A single thank-you / completion page. A form may have several when
 *  `completion_logic` routes different multiple-choice answers to different
 *  screens. The first screen is always the default. */
export type MetaLeadFormCompletionScreen = {
  id: string;
  headline: string;
  description: string;
  button_label: string;
  button_url: string;
};

/** Optional conditional routing — pick a multiple-choice question and map each
 *  of its options to a completion screen. Anything unmapped uses
 *  `default_screen_id`. */
export type MetaLeadFormCompletionLogic = {
  question_id: string;
  default_screen_id: string;
  rules: { option: string; screen_id: string }[];
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
  /** Multi-screen completion — first entry is the default. */
  completion_screens?: MetaLeadFormCompletionScreen[];
  /** Optional conditional routing. Null/undefined means always use the default screen. */
  completion_logic?: MetaLeadFormCompletionLogic | null;
  /** @deprecated legacy single-screen fields — read via getCompletionScreens(). */
  completion_headline?: string;
  /** @deprecated */
  completion_description?: string;
  /** @deprecated */
  completion_button_label?: string;
  /** @deprecated */
  completion_url?: string;
};

/** Returns the form's completion screens, migrating legacy flat fields when needed.
 *  Always returns at least one screen. */
export function getCompletionScreens(data: MetaLeadFormData): MetaLeadFormCompletionScreen[] {
  if (data.completion_screens && data.completion_screens.length > 0) {
    return data.completion_screens;
  }
  return [{
    id: 'default',
    headline: data.completion_headline || '',
    description: data.completion_description || '',
    button_label: data.completion_button_label || '',
    button_url: data.completion_url || '',
  }];
}

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

/** Sitelink asset attached to a Google Search ad. */
export type GoogleAdSitelink = {
  id: string;
  text: string;
  description1?: string;
  description2?: string;
  url: string;
};

/** Shape stored in `review_items.google_ad_data` (jsonb) for search + banner ads. */
export type GoogleAdData = {
  final_url: string;
  display_url: string;
  /** Display path segment 1 — e.g. "products" → example.com/products. Max 15 chars. */
  path1?: string;
  /** Display path segment 2 — e.g. "skip-bins" → example.com/products/skip-bins. Max 15 chars. */
  path2?: string;
  business_name?: string;
  /** Up to 15 headlines, each ≤30 chars. Google rotates these. */
  headlines: string[];
  /** Up to 4 descriptions, each ≤90 chars. */
  descriptions: string[];
  /** Up to 6 sitelinks. */
  sitelinks: GoogleAdSitelink[];
  /** Call extension phone number (E.164 or local). Shown in preview. */
  call_phone?: string;
  /** Banner-ad only: uploaded creative URL. Search ads ignore this. */
  banner_image_url?: string;
};

export function emptyGoogleAdData(): GoogleAdData {
  return {
    final_url: '',
    display_url: '',
    headlines: [],
    descriptions: [],
    sitelinks: [],
  };
}

/** Identifier of a sub-view inside a mockup (e.g. lead-form page,
 *  email client, ad platform). Plain string so each mockup can use its own
 *  union without needing to know about the others. `null` = the item has
 *  no sub-views (image, video, pdf, webpage). */
export type FeedbackItemView = string | null;

/** One copy variant of a Meta ad — a (primary text, headline) pair that
 *  shares the item's creative image, CTA, and platform. Reviewers can
 *  switch between variants in the sidebar and pin comments to a specific
 *  variant. Variant IDs are stable (not positional), so deleting / reordering
 *  variants doesn't move pins on the other variants. */
export type MetaAdVariant = {
  /** Stable short id (e.g. 8-char nanoid). Used inside `variant-<id>` view strings. */
  id: string;
  /** Optional human label (e.g. "Pain point hook", "Original copy"). Falls
   *  back to "Variant N" in the editor / sidebar / picker when empty. */
  label?: string | null;
  primary_text: string;
  headline: string;
};

/** Build the view string used to scope pin comments to a specific variant. */
export function metaAdVariantView(variantId: string): string {
  return `variant-${variantId}`;
}

/** Inverse of {@link metaAdVariantView}. Returns null for non-variant views. */
export function parseMetaAdVariantView(view: FeedbackItemView): { id: string } | null {
  if (!view) return null;
  const match = /^variant-(.+)$/.exec(view);
  return match ? { id: match[1] } : null;
}

/** Returns the variants array for an ad item, synthesising a single
 *  fallback variant from the legacy `ad_headline` / `ad_copy` columns when
 *  no explicit variants have been saved yet. The synthesised id is stable
 *  for an item so pins placed during the legacy flow keep their target if
 *  callers later choose to migrate (currently unused — legacy pins use
 *  platform views and don't show in variant mode). */
export function getMetaAdVariants(item: {
  meta_ad_variants?: MetaAdVariant[] | null;
  ad_headline?: string | null;
  ad_copy?: string | null;
}): MetaAdVariant[] {
  const stored = Array.isArray(item.meta_ad_variants) ? item.meta_ad_variants : null;
  if (stored && stored.length > 0) return stored;
  return [{
    id: 'legacy-v1',
    label: null,
    headline: item.ad_headline ?? '',
    primary_text: item.ad_copy ?? '',
  }];
}

/** Default sub-view to show when an item is first opened. Pins persist their
 *  view in `annotation_data.view`, so this also defines which pins are
 *  visible by default. */
export function defaultViewForItem(item: {
  type: FeedbackItemType;
  ad_platform?: string | null;
  meta_ad_variants?: MetaAdVariant[] | null;
  ad_headline?: string | null;
  ad_copy?: string | null;
}): FeedbackItemView {
  switch (item.type) {
    case 'meta_lead_form':   return 'intro';
    case 'email':            return 'inbox_preview';
    case 'sms':              return 'imessage';
    case 'ad': {
      // When the item has explicit copy variants, the view is variant-scoped
      // so pin comments follow the active variant. Otherwise fall back to
      // legacy platform-scoped views.
      const variants = Array.isArray(item.meta_ad_variants) ? item.meta_ad_variants : null;
      if (variants && variants.length > 0) return metaAdVariantView(variants[0].id);
      return item.ad_platform || 'facebook_feed';
    }
    // Google Search ads: the "view" doubles as the per-asset feedback target.
    // Default to the first headline so the comments panel + composer are scoped
    // to a concrete asset on first open.
    case 'google_search_ad': return 'headline-0';
    default:                 return null;
  }
}

/** Parse a Google Search ad view string ("headline-3" / "description-1")
 *  back into a typed asset reference. Returns null for non-asset views. */
export function parseGoogleAdAssetView(view: FeedbackItemView): { type: 'headline' | 'description'; index: number } | null {
  if (!view) return null;
  const match = /^(headline|description)-(\d+)$/.exec(view);
  if (!match) return null;
  return { type: match[1] as 'headline' | 'description', index: parseInt(match[2], 10) };
}

/** Build a Google Search ad asset view string from a typed reference. */
export function googleAdAssetView(type: 'headline' | 'description', index: number): string {
  return `${type}-${index}`;
}

/** Reads the view a pin/annotation/highlight was created on. Returns null
 *  for legacy comments without a stored view — those won't match any view
 *  and therefore won't render on view-scoped mockups. */
export function getCommentView(annotation_data: unknown): FeedbackItemView {
  if (annotation_data && typeof annotation_data === 'object') {
    const v = (annotation_data as Record<string, unknown>).view;
    if (typeof v === 'string') return v;
  }
  return null;
}

export type FeedbackItem = {
  id: string;
  review_project_id: string;
  company_id: string;
  title: string;
  type: FeedbackItemType;
  sort_order: number;
  url: string | null;
  html_content: string | null;
  // Meta ad fields
  ad_headline: string | null;
  ad_copy: string | null;
  ad_cta: string | null;
  ad_creative_url: string | null;
  ad_platform: string | null;
  /** When non-empty, replaces the single ad_headline/ad_copy preview with
   *  a sidebar of (primary_text, headline) variants. ad_headline / ad_copy
   *  are kept in sync with the first variant for legacy consumers. */
  meta_ad_variants: MetaAdVariant[] | null;
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
  // Google Ad (jsonb blob — see GoogleAdData)
  google_ad_data: GoogleAdData | null;
  // Meta Lead Form (jsonb blob — see MetaLeadFormData)
  meta_lead_form_data: MetaLeadFormData | null;
  // Meta
  status: FeedbackStatus;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  meta_ad_variants: MetaAdVariant[] | null;
  email_subject: string | null;
  email_preheader: string | null;
  email_body: string | null;
  sms_body: string | null;
  image_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  google_ad_data: GoogleAdData | null;
  meta_lead_form_data: MetaLeadFormData | null;
  /** review_items.status at the moment this version row was inserted.
   *  Populated by the `trg_set_review_version_prior_status` BEFORE INSERT
   *  trigger. Used by VersionPicker to render a per-row "this is the stage
   *  the predecessor ended up at" badge. */
  prior_status: FeedbackStatus | null;
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
  tasks?: CommentTask[];
  created_at: string;
  updated_at: string;
};

export type FeedbackCommentAttachment = {
  url: string;
  name: string;
  type: string;
  size: number;
};

export type CommentTaskAttachment = {
  path: string;
  name: string;
  size: number;
  type: string;
};

export type CommentTask = {
  id: string;
  comment_id: string;
  company_id: string;
  assigned_to: string;
  assigned_by: string | null;
  instructions: string | null;
  attachments: CommentTaskAttachment[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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
  | 'call' | 'meeting' | 'automation' | 'goal'
  | 'button_click' | 'form_submit' | 'video_play' | 'scroll_depth'
  | 'purchase' | 'add_to_cart' | 'subscribe' | 'custom_event'
  | 'page_view' | 'time_on_page' | 'exit_intent' | 'refund'
  | 'download' | 'share' | 'login'
  | 'sms_notification' | 'email_notification' | 'ghl_notification'
  | 'google_sheet' | 'webhook'
  | 'form_completed' | 'schedule_meeting' | 'deal_won'
  | 'ghl_appointment' | 'ghl_order' | 'ghl_opportunity' | 'ghl_opportunity_won'
  | 'on_site_visit' | 'send_quote'
  | 'send_google_review' | 'add_to_referral_program';

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

