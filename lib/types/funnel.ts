// lib/types/funnel.ts
//
// Types for the Funnel Planner — a Funnelytics-style drag-and-drop canvas for
// mapping marketing funnels visually. No live data; pure visualisation.
//
// The data model deliberately mirrors `review_board_*` (see lib/types/feedback.ts)
// so we can reuse ShapeNode, StickyNoteNode, and LabeledEdge from the feedback
// board without re-implementing them. Only the FK column changes
// (review_project_id → funnel_id) and the step-node taxonomy is new.

export type FunnelStatus = 'draft' | 'active' | 'archived';

export type FunnelStepType =
  // Traffic sources
  | 'traffic_paid'
  | 'traffic_organic'
  | 'traffic_email'
  | 'traffic_direct'
  // Pages
  | 'page_landing'
  | 'page_sales'
  | 'page_optin'
  | 'page_checkout'
  | 'page_thankyou'
  | 'page_upsell'
  | 'page_downsell'
  | 'page_webinar'
  // Offers
  | 'offer_product'
  | 'offer_course'
  | 'offer_service'
  | 'offer_lead_magnet'
  // Catch-all
  | 'generic';

export type FunnelStepCategory = 'traffic' | 'page' | 'offer' | 'generic';

export function categoryForStepType(t: FunnelStepType): FunnelStepCategory {
  if (t.startsWith('traffic_')) return 'traffic';
  if (t.startsWith('page_')) return 'page';
  if (t.startsWith('offer_')) return 'offer';
  return 'generic';
}

export type Funnel = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: FunnelStatus;
  share_token: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FunnelStep = {
  id: string;
  funnel_id: string;
  company_id: string;
  step_type: FunnelStepType;
  label: string;
  /** Lucide icon name OR brand slug (e.g. "facebook", "google"). Optional —
   *  falls back to a category default. */
  icon: string | null;
  /** Optional reference URL (e.g. the live page URL). Display-only. */
  url: string | null;
  /** Tailwind/CSS hex color tint for the node. Optional — uses a category
   *  default when null. */
  color: string | null;
  board_x: number;
  board_y: number;
  metrics: FunnelStepMetrics;
  created_at: string;
  updated_at: string;
};

/** Manual planner metrics — all optional. Used to forecast flow + revenue
 *  through the funnel. No live data, no tracking — user fills these in. */
export type FunnelStepMetrics = {
  /** Source nodes only: incoming visitors this source delivers. */
  visitors?: number | null;
  /** 0-100. Share of incoming visitors that move forward from this step. */
  conversion_rate?: number | null;
  /** Per-visitor (sources) or per-conversion (offers) cost. */
  cost?: number | null;
  /** Revenue per conversion at this step (offers/upsells/etc). */
  value?: number | null;
  /** Freeform note shown in the side drawer only. */
  notes?: string | null;
};

/** Edge between two funnel nodes — funnel step OR shape (decision, action,
 *  etc.). Mirrors `review_board_edges`. */
export type FunnelBoardEdge = {
  id: string;
  funnel_id: string;
  company_id: string;
  source_step_id: string | null;
  source_shape_id: string | null;
  target_step_id: string | null;
  target_shape_id: string | null;
  source_handle: string;
  target_handle: string;
  label: string | null;
  edge_type: string;
  animated: boolean;
  /** When a node fans out to multiple targets, the share of upstream flow
   *  routed along this edge. 0-100. Null means "auto / even split". */
  split_percent: number | null;
  style: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FunnelBoardNote = {
  id: string;
  funnel_id: string;
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

/** Same shape_type union as `FeedbackShapeType` — the reused ShapeNode renders
 *  identical decision/wait/event/action nodes inside the funnel canvas. */
export type FunnelShapeType =
  | 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text'
  | 'decision' | 'wait'
  | 'call' | 'meeting' | 'automation' | 'goal'
  | 'button_click' | 'form_submit' | 'video_play' | 'scroll_depth'
  | 'purchase' | 'add_to_cart' | 'subscribe' | 'custom_event'
  | 'sms_notification' | 'email_notification' | 'ghl_notification' | 'google_sheet';

export type FunnelBoardShape = {
  id: string;
  funnel_id: string;
  company_id: string;
  shape_type: FunnelShapeType;
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

/** Default visual treatment per step type, used when the row's icon/color are null. */
export const FUNNEL_STEP_DEFAULTS: Record<
  FunnelStepType,
  { label: string; icon: string; color: string; tint: string }
> = {
  traffic_paid:        { label: 'Paid Traffic',     icon: 'megaphone',     color: '#2B2B2B', tint: '#1877F2' },
  traffic_organic:     { label: 'Organic Traffic',  icon: 'search',        color: '#2B2B2B', tint: '#10B981' },
  traffic_email:       { label: 'Email Traffic',    icon: 'mail',          color: '#2B2B2B', tint: '#F59E0B' },
  traffic_direct:      { label: 'Direct',           icon: 'link',          color: '#2B2B2B', tint: '#6366F1' },
  page_landing:        { label: 'Landing Page',     icon: 'monitor',       color: '#2B2B2B', tint: '#0EA5E9' },
  page_sales:          { label: 'Sales Page',       icon: 'badge-dollar',  color: '#2B2B2B', tint: '#06B6D4' },
  page_optin:          { label: 'Opt-In Page',      icon: 'user-plus',     color: '#2B2B2B', tint: '#0EA5E9' },
  page_checkout:       { label: 'Checkout',         icon: 'credit-card',   color: '#2B2B2B', tint: '#22C55E' },
  page_thankyou:       { label: 'Thank You Page',   icon: 'heart',         color: '#2B2B2B', tint: '#EC4899' },
  page_upsell:         { label: 'Upsell Page',      icon: 'trending-up',   color: '#2B2B2B', tint: '#A855F7' },
  page_downsell:       { label: 'Downsell Page',    icon: 'trending-down', color: '#2B2B2B', tint: '#F43F5E' },
  page_webinar:        { label: 'Webinar',          icon: 'video',         color: '#2B2B2B', tint: '#8B5CF6' },
  offer_product:       { label: 'Product',          icon: 'package',       color: '#2B2B2B', tint: '#F97316' },
  offer_course:        { label: 'Course',           icon: 'graduation-cap',color: '#2B2B2B', tint: '#EAB308' },
  offer_service:       { label: 'Service',          icon: 'briefcase',     color: '#2B2B2B', tint: '#0891B2' },
  offer_lead_magnet:   { label: 'Lead Magnet',      icon: 'gift',          color: '#2B2B2B', tint: '#DB2777' },
  generic:             { label: 'Step',             icon: 'square',        color: '#2B2B2B', tint: '#64748B' },
};

/** Curated icon library shown in the side drawer's icon picker. Lucide slugs
 *  are rendered through the LUCIDE map in FunnelStepNode; brand slugs load
 *  from /public/icons/brands/. Keep groups short — this isn't an exhaustive
 *  catalogue, just the funnel-relevant subset. */
export const FUNNEL_ICON_LIBRARY: { group: string; icons: string[] }[] = [
  { group: 'Pages',      icons: ['monitor','badge-dollar','user-plus','credit-card','heart','trending-up','trending-down','video'] },
  { group: 'Traffic',    icons: ['megaphone','search','mail','link','globe','smartphone'] },
  { group: 'Offers',     icons: ['package','graduation-cap','briefcase','gift','sparkles','target'] },
  { group: 'Actions',    icons: ['phone','message-square','calendar','zap','flag','file-text','image','music'] },
  { group: 'Brands',     icons: ['facebook','google','youtube','tiktok','instagram','stripe','mailchimp','linkedin'] },
];

/** Color presets for the node tint swatch (12 swatches in the drawer). */
export const FUNNEL_COLOR_PRESETS: string[] = [
  '#1877F2', '#10B981', '#F59E0B', '#6366F1',
  '#0EA5E9', '#06B6D4', '#22C55E', '#EC4899',
  '#A855F7', '#F43F5E', '#F97316', '#64748B',
];

export const FUNNEL_STEP_TYPE_ORDER: { category: FunnelStepCategory; label: string; types: FunnelStepType[] }[] = [
  {
    category: 'traffic',
    label: 'Traffic',
    types: ['traffic_paid', 'traffic_organic', 'traffic_email', 'traffic_direct'],
  },
  {
    category: 'page',
    label: 'Pages',
    types: [
      'page_landing', 'page_sales', 'page_optin', 'page_checkout',
      'page_thankyou', 'page_upsell', 'page_downsell', 'page_webinar',
    ],
  },
  {
    category: 'offer',
    label: 'Offers',
    types: ['offer_product', 'offer_course', 'offer_service', 'offer_lead_magnet'],
  },
  {
    category: 'generic',
    label: 'Other',
    types: ['generic'],
  },
];

/** Unified palette config — drives the left rail. Mixes step nodes, flow
 *  shapes (decision / wait / events / notifications), and sticky notes into
 *  one categorised list so the user has a single place to add anything to
 *  the canvas. */
export type FunnelShapePaletteId =
  | 'decision' | 'wait' | 'goal'
  | 'call' | 'meeting' | 'automation'
  | 'button_click' | 'form_submit' | 'video_play' | 'scroll_depth'
  | 'purchase' | 'add_to_cart' | 'subscribe' | 'custom_event'
  | 'sms_notification' | 'email_notification' | 'ghl_notification' | 'google_sheet';

export type PaletteItem =
  | { kind: 'step'; stepType: FunnelStepType }
  | { kind: 'shape'; shapeType: FunnelShapePaletteId; label: string; iconName: string }
  | { kind: 'sticky' };

export interface PaletteGroup {
  key: string;
  label: string;
  items: PaletteItem[];
}

export const FUNNEL_PALETTE: PaletteGroup[] = [
  {
    key: 'pages',
    label: 'Pages',
    items: ([
      'page_landing', 'page_sales', 'page_optin', 'page_checkout',
      'page_thankyou', 'page_upsell', 'page_downsell', 'page_webinar',
    ] as FunnelStepType[]).map((stepType) => ({ kind: 'step', stepType })),
  },
  {
    key: 'traffic',
    label: 'Traffic',
    items: ([
      'traffic_paid', 'traffic_organic', 'traffic_email', 'traffic_direct',
    ] as FunnelStepType[]).map((stepType) => ({ kind: 'step', stepType })),
  },
  {
    key: 'offers',
    label: 'Offers',
    items: ([
      'offer_product', 'offer_course', 'offer_service', 'offer_lead_magnet',
    ] as FunnelStepType[]).map((stepType) => ({ kind: 'step', stepType })),
  },
  {
    key: 'logic',
    label: 'Logic',
    items: [
      { kind: 'shape', shapeType: 'decision',   label: 'Decision',   iconName: 'diamond' },
      { kind: 'shape', shapeType: 'wait',       label: 'Wait',       iconName: 'clock' },
      { kind: 'shape', shapeType: 'goal',       label: 'Goal',       iconName: 'flag' },
      { kind: 'shape', shapeType: 'call',       label: 'Call',       iconName: 'phone' },
      { kind: 'shape', shapeType: 'meeting',    label: 'Meeting',    iconName: 'calendar-days' },
      { kind: 'shape', shapeType: 'automation', label: 'Automation', iconName: 'zap' },
    ],
  },
  {
    key: 'events',
    label: 'Events',
    items: [
      { kind: 'shape', shapeType: 'button_click', label: 'Button Click', iconName: 'mouse-pointer-click' },
      { kind: 'shape', shapeType: 'form_submit',  label: 'Form Submit',  iconName: 'file-text' },
      { kind: 'shape', shapeType: 'video_play',   label: 'Video Play',   iconName: 'play-circle' },
      { kind: 'shape', shapeType: 'scroll_depth', label: 'Scroll Depth', iconName: 'chevrons-down' },
      { kind: 'shape', shapeType: 'purchase',     label: 'Purchase',     iconName: 'shopping-bag' },
      { kind: 'shape', shapeType: 'add_to_cart',  label: 'Add to Cart',  iconName: 'shopping-cart' },
      { kind: 'shape', shapeType: 'subscribe',    label: 'Subscribe',    iconName: 'bell-ring' },
      { kind: 'shape', shapeType: 'custom_event', label: 'Custom Event', iconName: 'sparkles' },
    ],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    items: [
      { kind: 'shape', shapeType: 'sms_notification',   label: 'SMS',          iconName: 'message-square' },
      { kind: 'shape', shapeType: 'email_notification', label: 'Email',        iconName: 'mail' },
      { kind: 'shape', shapeType: 'ghl_notification',   label: 'GHL App',      iconName: 'bell' },
      { kind: 'shape', shapeType: 'google_sheet',       label: 'Google Sheet', iconName: 'sheet' },
    ],
  },
  {
    key: 'other',
    label: 'Other',
    items: [
      { kind: 'step', stepType: 'generic' },
      { kind: 'sticky' },
    ],
  },
];
