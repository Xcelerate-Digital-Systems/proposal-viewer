// lib/types/funnel.ts
//
// Types for the Funnel Planner — a Funnelytics-style drag-and-drop canvas for
// mapping marketing funnels visually. No live data; pure visualisation.
//
// The data model deliberately mirrors `review_board_*` (see lib/types/feedback.ts)
// so we can reuse ShapeNode, StickyNoteNode, and LabeledEdge from the feedback
// board without re-implementing them. Only the FK column changes
// (review_project_id → funnel_id) and the step-node taxonomy is new.

import { BOARD_ACTION_GROUPS, type BoardActionShapeId } from './board-actions';

export type FunnelStatus = 'draft' | 'active' | 'archived';

/** Currency for the summary chip + drawer. Stored as ISO 4217 code, rendered
 *  by formatMoney via Intl.NumberFormat. */
export type FunnelCurrency = 'USD' | 'AUD' | 'GBP' | 'EUR' | 'CAD' | 'NZD';

/** How manual metrics are interpreted:
 *   - total   → one-off run (what the metrics literally describe)
 *   - monthly → multiply visitor counts by 1 (one month) — totals are per-month
 *   - yearly  → multiply visitor counts by 12 — totals are per-year
 *  Single-run cost/value-per-conversion don't change; what changes is the
 *  multiplier applied to visitor flow before computing revenue/cost. */
export type FunnelForecastPeriod = 'total' | 'monthly' | 'yearly';

export const FUNNEL_CURRENCIES: { code: FunnelCurrency; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar' },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound' },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro' },
  { code: 'CAD', symbol: 'C$', label: 'CAD — Canadian Dollar' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZD — New Zealand Dollar' },
];

export const FUNNEL_PERIODS: { code: FunnelForecastPeriod; label: string; multiplier: number }[] = [
  { code: 'total',   label: 'One-off run',   multiplier: 1 },
  { code: 'monthly', label: 'Per month',     multiplier: 1 },
  { code: 'yearly',  label: 'Per year (12 months)', multiplier: 12 },
];

export type FunnelStepType =
  // Traffic sources — generic buckets
  | 'traffic_paid'
  | 'traffic_organic'
  | 'traffic_email'
  | 'traffic_direct'
  // Traffic sources — specific ad platforms (Funnelytics parity)
  | 'traffic_facebook_ads'
  | 'traffic_instagram_ads'
  | 'traffic_google_ads'
  | 'traffic_youtube_ads'
  | 'traffic_tiktok_ads'
  | 'traffic_linkedin_ads'
  | 'traffic_pinterest_ads'
  | 'traffic_twitter_ads'
  | 'traffic_snapchat_ads'
  | 'traffic_bing_ads'
  | 'traffic_reddit_ads'
  | 'traffic_native_ads'
  // Traffic sources — organic search (per platform)
  | 'traffic_google_organic'
  | 'traffic_bing_organic'
  | 'traffic_youtube_organic'
  // Traffic sources — organic social (per platform)
  | 'traffic_facebook_organic'
  | 'traffic_instagram_organic'
  | 'traffic_linkedin_organic'
  | 'traffic_tiktok_organic'
  | 'traffic_twitter_organic'
  | 'traffic_pinterest_organic'
  | 'traffic_reddit_organic'
  // Traffic sources — channels
  | 'traffic_sms'
  | 'traffic_organic_social'
  | 'traffic_referral'
  | 'traffic_affiliate'
  | 'traffic_podcast'
  | 'traffic_influencer'
  | 'traffic_offline'
  // Traffic sources — CRMs (clicks attributed to a CRM-driven send)
  | 'traffic_hubspot'
  | 'traffic_ghl'
  | 'traffic_activecampaign'
  | 'traffic_salesforce'
  | 'traffic_simpro'
  | 'traffic_aroflo'
  | 'traffic_workflowmax'
  | 'traffic_servicem8'
  | 'traffic_fergus'
  | 'traffic_ascora'
  | 'traffic_jobber'
  // Traffic sources — messaging platforms
  | 'traffic_slack'
  | 'traffic_messenger'
  | 'traffic_chatbot'
  // Traffic sources — other sites
  | 'traffic_zoho'
  | 'traffic_yelp'
  | 'traffic_amazon'
  | 'traffic_zoom'
  | 'traffic_gmail'
  | 'traffic_spotify'
  | 'traffic_snapchat_organic'
  | 'traffic_google_maps'
  // Traffic sources — offline channels
  | 'traffic_print_ad'
  | 'traffic_conference'
  | 'traffic_online_meeting'
  | 'traffic_direct_mail'
  | 'traffic_meeting'
  | 'traffic_billboard'
  | 'traffic_business_card'
  | 'traffic_phone'
  | 'traffic_report'
  | 'traffic_qr_code'
  // Pages
  | 'page_landing'
  | 'page_sales'
  | 'page_optin'
  | 'page_checkout'
  | 'page_thankyou'
  | 'page_upsell'
  | 'page_downsell'
  | 'page_webinar'
  | 'page_form'
  | 'page_calendar'
  // Offers
  | 'offer_product'
  | 'offer_course'
  | 'offer_service'
  | 'offer_lead_magnet'
  | 'offer_book'
  | 'offer_subscription'
  | 'offer_saas'
  | 'offer_trial'
  | 'offer_bundle'
  | 'offer_coaching'
  | 'offer_event'
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
  currency: FunnelCurrency;
  forecast_period: FunnelForecastPeriod;
  /** When set, this funnel was created as a "scenario" clone of another. */
  parent_funnel_id: string | null;
  /** Default revenue per conversion for the whole funnel. Steps inherit this
   *  when their own metrics.value is null. Lets agencies set "average deal
   *  value" once instead of per-step. */
  default_deal_value: number | null;
  /** Marks this funnel as a reusable template — hidden from the main funnels
   *  list and shown in the "Use template" gallery on the new-funnel flow. */
  is_template: boolean;
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
  /** For subscription / membership / SaaS offers: how many months of
   *  recurring revenue to count per conversion (effective LTV in months).
   *  Multiplies `value` per conversion. Defaults to 1 if unset. */
  recurring_months?: number | null;
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
  | 'page_view' | 'time_on_page' | 'exit_intent' | 'refund'
  | 'download' | 'share' | 'login'
  | 'sms_notification' | 'email_notification' | 'ghl_notification'
  | 'google_sheet' | 'webhook'
  | 'form_completed' | 'schedule_meeting' | 'deal_won'
  | 'ghl_appointment' | 'ghl_order' | 'ghl_opportunity' | 'ghl_opportunity_won'
  | 'on_site_visit' | 'send_quote'
  | 'send_google_review' | 'add_to_referral_program';

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

/** Default visual treatment per step type, used when the row's icon/color are null.
 *
 *  Brand-platform sources (Facebook Ads, Google Ads, etc.) default to a brand
 *  slug (e.g. 'facebook') for the icon. StepIcon attempts to render
 *  /icons/brands/<slug>.svg; if that asset isn't present yet, it falls back
 *  to a Lucide icon. This lets us ship brand defaults today and just drop in
 *  SVGs later without re-editing any step rows. */
export const FUNNEL_STEP_DEFAULTS: Record<
  FunnelStepType,
  { label: string; icon: string; color: string; tint: string }
> = {
  // Generic traffic buckets
  traffic_paid:           { label: 'Paid Traffic',       icon: 'megaphone',        color: '#2B2B2B', tint: '#1877F2' },
  traffic_organic:        { label: 'All Search',         icon: 'search',           color: '#2B2B2B', tint: '#EF4444' },
  traffic_email:          { label: 'Email',              icon: 'mail',             color: '#2B2B2B', tint: '#3B82F6' },
  traffic_direct:         { label: 'Direct',             icon: 'link',             color: '#2B2B2B', tint: '#6366F1' },
  // Specific ad platforms (brand slugs → brand SVG with Lucide fallback)
  traffic_facebook_ads:   { label: 'Facebook Ads',       icon: 'facebook',         color: '#2B2B2B', tint: '#1877F2' },
  traffic_instagram_ads:  { label: 'Instagram Ads',      icon: 'instagram',        color: '#2B2B2B', tint: '#E4405F' },
  traffic_google_ads:     { label: 'Google Ads',         icon: 'google',           color: '#2B2B2B', tint: '#4285F4' },
  traffic_youtube_ads:    { label: 'YouTube Ads',        icon: 'youtube',          color: '#2B2B2B', tint: '#FF0033' },
  traffic_tiktok_ads:     { label: 'TikTok Ads',         icon: 'tiktok',           color: '#2B2B2B', tint: '#111111' },
  traffic_linkedin_ads:   { label: 'LinkedIn Ads',       icon: 'linkedin',         color: '#2B2B2B', tint: '#0A66C2' },
  traffic_pinterest_ads:  { label: 'Pinterest Ads',      icon: 'pinterest',        color: '#2B2B2B', tint: '#E60023' },
  traffic_twitter_ads:    { label: 'X (Twitter) Ads',    icon: 'twitter',          color: '#2B2B2B', tint: '#111111' },
  traffic_snapchat_ads:   { label: 'Snapchat Ads',       icon: 'snapchat',         color: '#2B2B2B', tint: '#F7C701' },
  traffic_bing_ads:       { label: 'Bing Ads',           icon: 'bing',             color: '#2B2B2B', tint: '#F59E0B' },
  traffic_reddit_ads:     { label: 'Reddit Ads',         icon: 'reddit',           color: '#2B2B2B', tint: '#FF4500' },
  traffic_native_ads:     { label: 'Native Ads',         icon: 'megaphone',        color: '#2B2B2B', tint: '#F59E0B' },
  // Organic search
  traffic_google_organic:    { label: 'Google',          icon: 'google',           color: '#2B2B2B', tint: '#4285F4' },
  traffic_bing_organic:      { label: 'Bing',            icon: 'bing',             color: '#2B2B2B', tint: '#F59E0B' },
  traffic_youtube_organic:   { label: 'YouTube',         icon: 'youtube',          color: '#2B2B2B', tint: '#FF0033' },
  // Organic social
  traffic_facebook_organic:  { label: 'Facebook',        icon: 'facebook',         color: '#2B2B2B', tint: '#1877F2' },
  traffic_instagram_organic: { label: 'Instagram',       icon: 'instagram',        color: '#2B2B2B', tint: '#E4405F' },
  traffic_linkedin_organic:  { label: 'LinkedIn',        icon: 'linkedin',         color: '#2B2B2B', tint: '#0A66C2' },
  traffic_tiktok_organic:    { label: 'TikTok',          icon: 'tiktok',           color: '#2B2B2B', tint: '#111111' },
  traffic_twitter_organic:   { label: 'X',               icon: 'twitter',          color: '#2B2B2B', tint: '#111111' },
  traffic_pinterest_organic: { label: 'Pinterest',       icon: 'pinterest',        color: '#2B2B2B', tint: '#E60023' },
  traffic_reddit_organic:    { label: 'Reddit',          icon: 'reddit',           color: '#2B2B2B', tint: '#FF4500' },
  // Channels
  traffic_sms:            { label: 'SMS',                icon: 'message-square',   color: '#2B2B2B', tint: '#EC4899' },
  traffic_organic_social: { label: 'Organic Social',     icon: 'share-2',          color: '#2B2B2B', tint: '#A855F7' },
  traffic_referral:       { label: 'Referral',           icon: 'external-link',    color: '#2B2B2B', tint: '#0EA5E9' },
  traffic_affiliate:      { label: 'Affiliate',          icon: 'users',            color: '#2B2B2B', tint: '#EC4899' },
  traffic_podcast:        { label: 'Podcast',            icon: 'mic',              color: '#2B2B2B', tint: '#8B5CF6' },
  traffic_influencer:     { label: 'Influencer',         icon: 'star',             color: '#2B2B2B', tint: '#F97316' },
  traffic_offline:        { label: 'Offline / Print',    icon: 'newspaper',        color: '#2B2B2B', tint: '#64748B' },
  // CRMs
  traffic_hubspot:        { label: 'HubSpot',            icon: 'hubspot',          color: '#2B2B2B', tint: '#FF7A59' },
  traffic_ghl:            { label: 'GoHighLevel',        icon: 'ghl',              color: '#2B2B2B', tint: '#161616' },
  traffic_activecampaign: { label: 'ActiveCampaign',     icon: 'activecampaign',   color: '#2B2B2B', tint: '#356AE6' },
  traffic_salesforce:     { label: 'Salesforce',         icon: 'salesforce',       color: '#2B2B2B', tint: '#00A1E0' },
  traffic_simpro:         { label: 'Simpro',             icon: 'simpro',           color: '#2B2B2B', tint: '#1C8DC9' },
  traffic_aroflo:         { label: 'AroFlo',             icon: 'aroflo',           color: '#2B2B2B', tint: '#1D8C2C' },
  traffic_workflowmax:    { label: 'WorkflowMax',        icon: 'workflowmax',      color: '#2B2B2B', tint: '#00A0DC' },
  traffic_servicem8:      { label: 'ServiceM8',          icon: 'servicem8',        color: '#2B2B2B', tint: '#0094E5' },
  traffic_fergus:         { label: 'Fergus',             icon: 'fergus',           color: '#2B2B2B', tint: '#2E83B7' },
  traffic_ascora:         { label: 'Ascora',             icon: 'ascora',           color: '#2B2B2B', tint: '#FF5A1F' },
  traffic_jobber:         { label: 'Jobber',             icon: 'jobber',           color: '#2B2B2B', tint: '#00BD9C' },
  // Messaging platforms
  traffic_slack:          { label: 'Slack',              icon: 'slack',            color: '#2B2B2B', tint: '#4A154B' },
  traffic_messenger:      { label: 'Messenger',          icon: 'messenger',        color: '#2B2B2B', tint: '#00B2FF' },
  traffic_chatbot:        { label: 'Chatbot',            icon: 'chatbot',          color: '#2B2B2B', tint: '#6366F1' },
  // Other sites
  traffic_zoho:               { label: 'Zoho',              icon: 'zoho',         color: '#2B2B2B', tint: '#C8202F' },
  traffic_yelp:               { label: 'Yelp',              icon: 'yelp',         color: '#2B2B2B', tint: '#D32323' },
  traffic_amazon:             { label: 'Amazon',            icon: 'amazon',       color: '#2B2B2B', tint: '#FF9900' },
  traffic_zoom:               { label: 'Zoom',              icon: 'zoom',         color: '#2B2B2B', tint: '#2D8CFF' },
  traffic_gmail:              { label: 'Gmail',             icon: 'gmail',        color: '#2B2B2B', tint: '#EA4335' },
  traffic_spotify:            { label: 'Spotify',           icon: 'spotify',      color: '#2B2B2B', tint: '#1DB954' },
  traffic_snapchat_organic:   { label: 'Snapchat',          icon: 'snapchat',     color: '#2B2B2B', tint: '#F7C701' },
  traffic_google_maps:        { label: 'Google Maps',       icon: 'google-maps',  color: '#2B2B2B', tint: '#34A853' },
  // Offline
  traffic_print_ad:           { label: 'Print Ad',          icon: 'newspaper',      color: '#2B2B2B', tint: '#64748B' },
  traffic_conference:         { label: 'Conference',        icon: 'users',          color: '#2B2B2B', tint: '#7C3AED' },
  traffic_online_meeting:     { label: 'Online Meeting',    icon: 'video',          color: '#2B2B2B', tint: '#2D8CFF' },
  traffic_direct_mail:        { label: 'Direct Mail',       icon: 'mail',           color: '#2B2B2B', tint: '#F59E0B' },
  traffic_meeting:            { label: 'Meeting',           icon: 'calendar',       color: '#2B2B2B', tint: '#A855F7' },
  traffic_billboard:          { label: 'Billboard',         icon: 'monitor',        color: '#2B2B2B', tint: '#EF4444' },
  traffic_business_card:      { label: 'Business Card',     icon: 'square-user',    color: '#2B2B2B', tint: '#0EA5E9' },
  traffic_phone:              { label: 'Phone',             icon: 'phone',          color: '#2B2B2B', tint: '#10B981' },
  traffic_report:             { label: 'Report',            icon: 'file-text',      color: '#2B2B2B', tint: '#6B7280' },
  traffic_qr_code:            { label: 'QR Code',           icon: 'qr-code',        color: '#2B2B2B', tint: '#111111' },
  // Pages
  page_landing:           { label: 'Landing Page',       icon: 'monitor',          color: '#2B2B2B', tint: '#0EA5E9' },
  page_sales:             { label: 'Sales Page',         icon: 'badge-dollar',     color: '#2B2B2B', tint: '#06B6D4' },
  page_optin:             { label: 'Opt-In Page',        icon: 'user-plus',        color: '#2B2B2B', tint: '#0EA5E9' },
  page_checkout:          { label: 'Checkout',           icon: 'credit-card',      color: '#2B2B2B', tint: '#22C55E' },
  page_thankyou:          { label: 'Thank You Page',     icon: 'heart',            color: '#2B2B2B', tint: '#EC4899' },
  page_upsell:            { label: 'Upsell Page',        icon: 'trending-up',      color: '#2B2B2B', tint: '#A855F7' },
  page_downsell:          { label: 'Downsell Page',      icon: 'trending-down',    color: '#2B2B2B', tint: '#F43F5E' },
  page_webinar:           { label: 'Webinar',            icon: 'video',            color: '#2B2B2B', tint: '#8B5CF6' },
  page_form:              { label: 'Form Page',          icon: 'file-text',        color: '#2B2B2B', tint: '#14B8A6' },
  page_calendar:          { label: 'Calendar Page',      icon: 'calendar',         color: '#2B2B2B', tint: '#6366F1' },
  // Offers
  offer_product:          { label: 'Product',            icon: 'package',          color: '#2B2B2B', tint: '#F97316' },
  offer_course:           { label: 'Course',             icon: 'graduation-cap',   color: '#2B2B2B', tint: '#EAB308' },
  offer_service:          { label: 'Service',            icon: 'briefcase',        color: '#2B2B2B', tint: '#0891B2' },
  offer_lead_magnet:      { label: 'Lead Magnet',        icon: 'gift',             color: '#2B2B2B', tint: '#DB2777' },
  offer_book:             { label: 'Book / eBook',       icon: 'book-open',        color: '#2B2B2B', tint: '#7C3AED' },
  offer_subscription:     { label: 'Subscription',       icon: 'repeat',           color: '#2B2B2B', tint: '#0891B2' },
  offer_saas:             { label: 'SaaS / Software',    icon: 'cloud',            color: '#2B2B2B', tint: '#0EA5E9' },
  offer_trial:            { label: 'Free Trial',         icon: 'timer',            color: '#2B2B2B', tint: '#10B981' },
  offer_bundle:           { label: 'Bundle',             icon: 'layers',           color: '#2B2B2B', tint: '#F97316' },
  offer_coaching:         { label: 'Coaching',           icon: 'user-cog',         color: '#2B2B2B', tint: '#EC4899' },
  offer_event:            { label: 'Live Event',         icon: 'ticket',           color: '#2B2B2B', tint: '#A855F7' },
  // Catch-all
  generic:                { label: 'Step',               icon: 'square',           color: '#2B2B2B', tint: '#64748B' },
};

/** Curated icon library shown in the side drawer's icon picker. Lucide slugs
 *  are rendered through the LUCIDE map in FunnelStepNode; brand slugs load
 *  from /public/icons/brands/. Keep groups short — this isn't an exhaustive
 *  catalogue, just the funnel-relevant subset. */
export const FUNNEL_ICON_LIBRARY: { group: string; icons: string[] }[] = [
  { group: 'Pages',      icons: ['monitor','badge-dollar','user-plus','credit-card','heart','trending-up','trending-down','video'] },
  { group: 'Traffic',    icons: ['megaphone','search','mail','link','globe','smartphone','share-2','external-link','users','mic','star','newspaper'] },
  { group: 'Offers',     icons: ['package','graduation-cap','briefcase','gift','sparkles','target','book-open','cloud','repeat','timer','layers','user-cog','ticket'] },
  { group: 'Actions',    icons: ['phone','message-square','calendar','zap','flag','file-text','image','music'] },
  { group: 'Brands',     icons: ['facebook','instagram','google','youtube','tiktok','linkedin','pinterest','twitter','snapchat','bing','stripe','mailchimp'] },
];

/** Color presets for the node tint swatch (12 swatches in the drawer). */
export const FUNNEL_COLOR_PRESETS: string[] = [
  '#1877F2', '#10B981', '#F59E0B', '#6366F1',
  '#0EA5E9', '#06B6D4', '#22C55E', '#EC4899',
  '#A855F7', '#F43F5E', '#F97316', '#64748B',
];

const ALL_TRAFFIC_TYPES: FunnelStepType[] = [
  'traffic_facebook_ads', 'traffic_instagram_ads', 'traffic_google_ads',
  'traffic_youtube_ads', 'traffic_tiktok_ads', 'traffic_linkedin_ads',
  'traffic_pinterest_ads', 'traffic_twitter_ads', 'traffic_snapchat_ads',
  'traffic_bing_ads', 'traffic_native_ads',
  'traffic_paid', 'traffic_organic', 'traffic_organic_social',
  'traffic_email', 'traffic_sms',
  'traffic_referral', 'traffic_affiliate', 'traffic_influencer',
  'traffic_podcast', 'traffic_offline', 'traffic_direct',
];

const ALL_OFFER_TYPES: FunnelStepType[] = [
  'offer_product', 'offer_course', 'offer_service', 'offer_lead_magnet',
  'offer_book', 'offer_subscription', 'offer_saas', 'offer_trial',
  'offer_bundle', 'offer_coaching', 'offer_event',
];

export const FUNNEL_STEP_TYPE_ORDER: { category: FunnelStepCategory; label: string; types: FunnelStepType[] }[] = [
  { category: 'traffic', label: 'Traffic', types: ALL_TRAFFIC_TYPES },
  {
    category: 'page',
    label: 'Pages',
    types: [
      'page_landing', 'page_sales', 'page_optin', 'page_form', 'page_calendar',
      'page_checkout', 'page_thankyou', 'page_upsell', 'page_downsell', 'page_webinar',
    ],
  },
  { category: 'offer', label: 'Offers', types: ALL_OFFER_TYPES },
  { category: 'generic', label: 'Other', types: ['generic'] },
];

/** Unified palette config — drives the left rail. Mixes step nodes, flow
 *  shapes (decision / wait / events / notifications), and sticky notes into
 *  one categorised list so the user has a single place to add anything to
 *  the canvas. */
export type FunnelPrimitiveShapeId = 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text';
export type FunnelShapePaletteId = BoardActionShapeId | FunnelPrimitiveShapeId;

export type PaletteItem =
  | { kind: 'step'; stepType: FunnelStepType }
  | { kind: 'shape'; shapeType: FunnelShapePaletteId; label: string; iconName: string }
  | { kind: 'sticky' }
  /** Renders the "+ Upload custom" stub in any Custom subgroup. */
  | { kind: 'upload'; scope: 'source' | 'page' | 'action' };

export interface PaletteGroup {
  key: string;
  label: string;
  items: PaletteItem[];
}

export type FunnelPaletteTabId = 'sources' | 'pages' | 'actions' | 'drawing';

export interface PaletteTab {
  id: FunnelPaletteTabId;
  label: string;
  groups: PaletteGroup[];
}

const stepItems = (types: FunnelStepType[]): PaletteItem[] =>
  types.map((stepType) => ({ kind: 'step', stepType }));

/** Funnelytics-style three-tab palette. Sub-groups expand/collapse inside
 *  each tab; "Custom" sub-groups render an upload stub. */
export const FUNNEL_PALETTE_TABS: PaletteTab[] = [
  {
    id: 'sources',
    label: 'Sources',
    groups: [
      {
        key: 'paid', label: 'Paid',
        items: stepItems([
          'traffic_facebook_ads', 'traffic_instagram_ads', 'traffic_google_ads',
          'traffic_youtube_ads', 'traffic_tiktok_ads', 'traffic_linkedin_ads',
          'traffic_pinterest_ads', 'traffic_twitter_ads', 'traffic_snapchat_ads',
          'traffic_bing_ads', 'traffic_reddit_ads', 'traffic_native_ads', 'traffic_paid',
        ]),
      },
      {
        key: 'search', label: 'Search',
        items: stepItems([
          'traffic_organic', 'traffic_google_organic', 'traffic_bing_organic', 'traffic_youtube_organic',
        ]),
      },
      {
        key: 'social', label: 'Social',
        items: stepItems([
          'traffic_facebook_organic', 'traffic_instagram_organic', 'traffic_linkedin_organic',
          'traffic_tiktok_organic', 'traffic_twitter_organic', 'traffic_pinterest_organic',
          'traffic_reddit_organic', 'traffic_organic_social',
        ]),
      },
      { key: 'other',     label: 'Other',     items: stepItems(['traffic_direct', 'traffic_referral', 'traffic_affiliate']) },
      {
        key: 'crm_src', label: 'CRM',
        items: stepItems([
          'traffic_hubspot', 'traffic_ghl', 'traffic_activecampaign', 'traffic_salesforce',
          'traffic_simpro', 'traffic_aroflo', 'traffic_workflowmax', 'traffic_servicem8',
          'traffic_fergus', 'traffic_ascora', 'traffic_jobber',
        ]),
      },
      {
        key: 'messaging_src', label: 'Messaging',
        items: stepItems(['traffic_slack', 'traffic_messenger', 'traffic_chatbot']),
      },
      {
        key: 'othersites', label: 'Other Sites',
        items: stepItems([
          'traffic_zoho', 'traffic_yelp', 'traffic_amazon', 'traffic_zoom',
          'traffic_gmail', 'traffic_spotify', 'traffic_snapchat_organic', 'traffic_google_maps',
        ]),
      },
      {
        key: 'offline', label: 'Offline',
        items: stepItems([
          'traffic_print_ad', 'traffic_conference', 'traffic_online_meeting', 'traffic_direct_mail',
          'traffic_meeting', 'traffic_billboard', 'traffic_business_card', 'traffic_phone',
          'traffic_report', 'traffic_qr_code',
          'traffic_offline', 'traffic_podcast', 'traffic_influencer',
        ]),
      },
      { key: 'custom_src', label: 'Custom', items: [{ kind: 'upload', scope: 'source' }] },
    ],
  },
  {
    id: 'pages',
    label: 'Pages',
    groups: [
      {
        key: 'pages', label: 'Pages',
        items: stepItems([
          'page_landing', 'page_sales', 'page_optin', 'page_form', 'page_calendar',
          'page_checkout', 'page_thankyou', 'page_upsell', 'page_downsell', 'page_webinar',
        ]),
      },
      {
        key: 'offers', label: 'Products',
        items: stepItems([
          'offer_product', 'offer_course', 'offer_service', 'offer_lead_magnet',
          'offer_book', 'offer_subscription', 'offer_saas', 'offer_trial',
          'offer_bundle', 'offer_coaching', 'offer_event',
        ]),
      },
      { key: 'custom_pages', label: 'Custom', items: [{ kind: 'upload', scope: 'page' }] },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    groups: [
      // Shared action groups — single source of truth in lib/types/board-actions.ts
      // so the same tiles appear in both the feedback and funnel boards.
      ...BOARD_ACTION_GROUPS.map<PaletteGroup>((g) => ({
        key: g.key,
        label: g.label,
        // Funnel's Custom Actions group additionally exposes a sticky tile and
        // the generic step node — both are funnel-only canvas primitives.
        items: g.key === 'custom_actions'
          ? [
              ...g.items.map<PaletteItem>((i) => ({ kind: 'shape', shapeType: i.shapeType, label: i.label, iconName: i.iconName })),
              { kind: 'sticky' },
              { kind: 'step', stepType: 'generic' },
            ]
          : g.items.map<PaletteItem>((i) => ({ kind: 'shape', shapeType: i.shapeType, label: i.label, iconName: i.iconName })),
      })),
      // Funnel-only: send traffic via email/sms as step nodes (these aren't
      // shape actions, they're traffic sources reused as actions).
      {
        key: 'messaging', label: 'Messaging',
        items: stepItems(['traffic_email', 'traffic_sms']),
      },
      { key: 'custom_act', label: 'Custom', items: [{ kind: 'upload', scope: 'action' }] },
    ],
  },
  {
    id: 'drawing',
    label: 'Drawing',
    groups: [
      {
        key: 'primitives',
        label: 'Shapes',
        items: [
          { kind: 'shape', shapeType: 'rectangle', label: 'Rectangle', iconName: 'square' },
          { kind: 'shape', shapeType: 'ellipse', label: 'Ellipse', iconName: 'circle' },
          { kind: 'shape', shapeType: 'arrow', label: 'Arrow', iconName: 'move-right' },
          { kind: 'shape', shapeType: 'line', label: 'Line', iconName: 'minus' },
          { kind: 'shape', shapeType: 'text', label: 'Text', iconName: 'type' },
        ],
      },
      {
        key: 'notes',
        label: 'Notes',
        items: [{ kind: 'sticky' }],
      },
    ],
  },
];

/** Legacy flat structure — kept temporarily for any consumer that still
 *  reads it. The active surface is `FUNNEL_PALETTE_TABS`. */
export const FUNNEL_PALETTE: PaletteGroup[] = FUNNEL_PALETTE_TABS.flatMap((t) => t.groups);
