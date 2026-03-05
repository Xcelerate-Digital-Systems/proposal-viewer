// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export type PackageFeatureIcon = 'dot' | 'check' | 'checkCircle' | 'arrow' | 'star' | 'dash';

export type PageNameEntry = {
  name: string;
  indent: number; // 0 = top level, 1 = nested child
  type?: 'page' | 'group'; // 'group' = section header only (no navigable page), default 'page'
  link_url?: string;   // optional external link attached to this page
  link_label?: string; // display label for the link button (defaults to 'View Resource')
  orientation?: 'portrait' | 'landscape' | 'auto';
};

/**
 * Normalize page_names from DB into PageNameEntry[].
 * Handles both legacy string[] and new {name, indent}[] formats.
 */
export function normalizePageNames(raw: unknown, count: number): PageNameEntry[] {
  const result: PageNameEntry[] = [];

  if (Array.isArray(raw)) {
    for (let i = 0; i < count; i++) {
      const item = raw[i];
      if (item && typeof item === 'object' && 'name' in item) {
        const obj = item as Record<string, unknown>;
        result.push({
          name: (obj.name as string) || `Page ${i + 1}`,
          indent: (obj.indent as number) || 0,
          ...(obj.type === 'group' ? { type: 'group' as const } : {}),
          ...(obj.link_url ? { link_url: obj.link_url as string } : {}),
          ...(obj.link_label ? { link_label: obj.link_label as string } : {}),
          ...(obj.orientation ? { orientation: obj.orientation as 'portrait' | 'landscape' | 'auto' } : {}),
        });
      } else if (typeof item === 'string') {
        result.push({ name: item, indent: 0 });
      } else {
        result.push({ name: `Page ${i + 1}`, indent: 0 });
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      result.push({ name: `Page ${i + 1}`, indent: 0 });
    }
  }

  return result.slice(0, count);
}

/**
 * Convert a 0-based PDF page index to the corresponding index in the entries array,
 * skipping over group entries that don't map to PDF pages.
 * Returns -1 if not found.
 */
export function pdfIndexToEntryIndex(entries: PageNameEntry[], pdfIndex: number): number {
  let pdfCount = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].type === 'group') continue;
    if (pdfCount === pdfIndex) return i;
    pdfCount++;
  }
  return -1;
}

/**
 * Normalize page_names from DB into PageNameEntry[], preserving groups.
 * Unlike normalizePageNames (which limits to `count` entries), this preserves
 * ALL entries including groups, only padding non-group entries to match `pdfCount`.
 */
export function normalizePageNamesWithGroups(raw: unknown, pdfCount: number): PageNameEntry[] {
  if (!Array.isArray(raw)) {
    return Array.from({ length: pdfCount }, (_, i) => ({ name: `Page ${i + 1}`, indent: 0 }));
  }

  const result: PageNameEntry[] = [];
  let realPagesSeen = 0;

  for (const item of raw) {
    if (item && typeof item === 'object' && 'name' in item) {
      const obj = item as Record<string, unknown>;
      const isGroup = obj.type === 'group';
      result.push({
        name: (obj.name as string) || (isGroup ? 'Section' : `Page ${realPagesSeen + 1}`),
        indent: (obj.indent as number) || 0,
        ...(isGroup ? { type: 'group' as const } : {}),
        ...(obj.link_url ? { link_url: obj.link_url as string } : {}),
        ...(obj.link_label ? { link_label: obj.link_label as string } : {}),
        ...(obj.orientation ? { orientation: obj.orientation as 'portrait' | 'landscape' | 'auto' } : {}),
      });
      if (!isGroup) realPagesSeen++;
    } else if (typeof item === 'string') {
      result.push({ name: item, indent: 0 });
      realPagesSeen++;
    }
  }

  // Pad if we have fewer real entries than PDF pages
  while (realPagesSeen < pdfCount) {
    result.push({ name: `Page ${realPagesSeen + 1}`, indent: 0 });
    realPagesSeen++;
  }

  return result;
}

export type Proposal = {
  id: string;
  title: string;
  client_name: string;
  client_email: string | null;
  crm_identifier: string | null;
  description: string | null;
  file_path: string;
  file_size_bytes: number | null;
  share_token: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined';
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  accepted_by_name: string | null;
  page_names: PageNameEntry[] | string[];
  cover_enabled: boolean;
  cover_image_path: string | null;
  cover_subtitle: string | null;
  cover_button_text: string;
  cover_bg_style: string | null;
  cover_bg_color_1: string | null;
  cover_bg_color_2: string | null;
  cover_gradient_type: string | null;
  cover_gradient_angle: number | null;
  cover_overlay_opacity: number | null;
  cover_text_color: string | null;
  cover_subtitle_color: string | null;
  cover_button_bg: string | null;
  cover_button_text_color: string | null;
  accept_button_text: string | null;
  post_accept_action: 'redirect' | 'message' | null;
  post_accept_redirect_url: string | null;
  post_accept_message: string | null;
  created_by_name: string | null;
  prepared_by: string | null;
  prepared_by_member_id: string | null;
  cover_client_logo_path: string | null;
  cover_avatar_path: string | null;
  cover_date: string | null;
  cover_show_client_logo: boolean;
  cover_show_avatar: boolean;
  cover_show_date: boolean;
  cover_show_prepared_by: boolean;
  bg_image_path: string | null;
  bg_image_overlay_opacity: number | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  page_orientation: 'auto' | 'portrait' | 'landscape';
  toc_settings: TocSettings | null;
  text_page_bg_color: string | null;
  title_font_family: string | null;
  title_font_weight: string | null;
  title_font_size: string | null;
  page_num_circle_color: string | null;
  page_num_text_color: string | null;
  text_page_text_color: string | null;
  text_page_heading_color: string | null;
  text_page_font_size: string | null;
  text_page_border_enabled: boolean | null;
  text_page_border_color: string | null;
  text_page_border_radius: string | null;
  text_page_layout: string | null;
};

export type Document = {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_size_bytes: number | null;
  share_token: string;
  page_names: PageNameEntry[] | string[];
  cover_enabled: boolean;
  cover_image_path: string | null;
  cover_subtitle: string | null;
  cover_button_text: string;
  cover_bg_style: string | null;
  cover_bg_color_1: string | null;
  cover_bg_color_2: string | null;
  cover_gradient_type: string | null;
  cover_gradient_angle: number | null;
  cover_overlay_opacity: number | null;
  cover_text_color: string | null;
  cover_subtitle_color: string | null;
  cover_button_bg: string | null;
  cover_button_text_color: string | null;
  cover_date: string | null;
  cover_show_date: boolean;
  bg_image_path: string | null;
  bg_image_overlay_opacity: number | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  page_orientation: 'auto' | 'portrait' | 'landscape';
  toc_settings: TocSettings | null;
  text_page_bg_color: string | null;
  text_page_text_color: string | null;
  text_page_heading_color: string | null;
  text_page_font_size: string | null;
  text_page_border_enabled: boolean | null;
  text_page_border_color: string | null;
  text_page_border_radius: string | null;
  text_page_layout: string | null;
  title_font_family: string | null;
  title_font_weight: string | null;
  title_font_size: string | null;
  page_num_circle_color: string | null;
  page_num_text_color: string | null;
};

export type ProposalComment = {
  id: string;
  proposal_id: string;
  author_name: string;
  author_type: 'team' | 'client';
  content: string;
  page_number: number | null;
  is_internal: boolean;
  parent_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  company_id: string;
  created_at: string;
};

export type ProposalTemplate = {
  id: string;
  name: string;
  description: string | null;
  page_count: number;
  cover_image_path: string | null;
  cover_enabled: boolean;
  cover_subtitle: string | null;
  cover_button_text: string;
  cover_bg_style: string | null;
  cover_bg_color_1: string | null;
  cover_bg_color_2: string | null;
  cover_gradient_type: string | null;
  cover_gradient_angle: number | null;
  cover_overlay_opacity: number | null;
  cover_text_color: string | null;
  cover_subtitle_color: string | null;
  cover_button_bg: string | null;
  cover_button_text_color: string | null;
  prepared_by: string | null;
  prepared_by_member_id: string | null;
  cover_client_logo_path: string | null;
  cover_avatar_path: string | null;
  cover_date: string | null;
  cover_show_client_logo: boolean;
  cover_show_avatar: boolean;
  cover_show_date: boolean;
  cover_show_prepared_by: boolean;
  section_headers: PageNameEntry[] | null;
  bg_image_path: string | null;
  bg_image_overlay_opacity: number | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  page_orientation: 'auto' | 'portrait' | 'landscape';
  toc_settings: TocSettings | null;
  text_page_bg_color: string | null;
  text_page_text_color: string | null;
  text_page_heading_color: string | null;
  text_page_font_size: string | null;
  text_page_border_enabled: boolean | null;
  text_page_border_color: string | null;
  text_page_border_radius: string | null;
  text_page_layout: string | null;
  title_font_family: string | null;
  title_font_weight: string | null;
  title_font_size: string | null;
  file_path: string | null; 
  page_num_circle_color: string | null;
  page_num_text_color: string | null;
};

export type TemplatePage = {
  id: string;
  template_id: string;
  page_number: number;
  file_path: string;
  label: string;
  indent: number; // 0 = top level, 1 = nested child (matches PageNameEntry)
  company_id: string;
  created_at: string;
};

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
  event_type: 'proposal_viewed' | 'proposal_accepted' | 'comment_added' | 'comment_resolved'
    | 'review_comment_added' | 'review_comment_resolved' | 'review_item_approved' | 'review_item_revision_needed';
  url: string;
  secret: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

// ─── Creative Review types ───────────────────────────────────────────────────

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

// ─── Board / Whiteboard types ────────────────────────────────────────────────

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

// ─── Pricing types ───────────────────────────────────────────────────────────

export type PricingLineItem = {
  id: string;
  label: string;
  description: string;
  percentage: number;
  amount: number;
  sort_order: number;
};

export type PricingOptionalItem = {
  id: string;
  label: string;
  description: string;
  amount: number;
  sort_order: number;
};

export type MilestonePayment = {
  id: string;
  label: string;
  type: 'percentage' | 'fixed';
  value: number;
  note: string;
};

export type PaymentSchedule = {
  one_off: {
    enabled: boolean;
    amount: number;
    label: string;
    note: string;
  };
  milestones: {
    enabled: boolean;
    payments: MilestonePayment[];
  };
  recurring: {
    enabled: boolean;
    amount: number;
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';
    label: string;
    note: string;
  };
};

export const DEFAULT_PAYMENT_SCHEDULE: PaymentSchedule = {
  one_off: { enabled: false, amount: 0, label: 'One-off Payment', note: 'Due on signing' },
  milestones: {
    enabled: false,
    payments: [
      { id: 'ms_deposit', label: 'Deposit', type: 'percentage', value: 50, note: 'Due on signing' },
      { id: 'ms_final', label: 'Final Payment', type: 'percentage', value: 50, note: 'Due on completion' },
    ],
  },
  recurring: { enabled: false, amount: 0, frequency: 'monthly', label: 'Ongoing Retainer', note: '' },
};

/**
 * Normalize a payment schedule from DB, handling both the old deposit/balance
 * format and the new milestones format for backward compatibility.
 */
export function normalizePaymentSchedule(raw: unknown): PaymentSchedule {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PAYMENT_SCHEDULE };

  const r = raw as Record<string, unknown>;

  // Already new format
  if (r.milestones && typeof r.milestones === 'object') {
    // Ensure one_off has amount field (may be missing from older data)
    const oneOff = r.one_off as Record<string, unknown> | undefined;
    return {
      ...(raw as PaymentSchedule),
      one_off: {
        enabled: !!(oneOff?.enabled),
        amount: (oneOff?.amount as number) ?? 0,
        label: (oneOff?.label as string) || 'One-off Payment',
        note: (oneOff?.note as string) || '',
      },
    };
  }

  // Legacy deposit/balance → migrate to milestones
  const dep = r.deposit as Record<string, unknown> | undefined;
  const bal = r.balance as Record<string, unknown> | undefined;

  if (dep) {
    const payments: MilestonePayment[] = [
      {
        id: 'ms_deposit',
        label: (dep.label as string) || 'Deposit',
        type: (dep.type as 'percentage' | 'fixed') || 'percentage',
        value: (dep.value as number) || 50,
        note: (dep.note as string) || 'Due on signing',
      },
    ];
    if (bal) {
      payments.push({
        id: 'ms_balance',
        label: (bal.label as string) || 'Balance Payment',
        type: 'percentage',
        value: dep.type === 'percentage' ? 100 - ((dep.value as number) || 50) : 0,
        note: (bal.note as string) || 'Due on project completion',
      });
    }
    return {
      one_off: (r.one_off as PaymentSchedule['one_off']) || DEFAULT_PAYMENT_SCHEDULE.one_off,
      milestones: {
        enabled: !!(dep.enabled),
        payments,
      },
      recurring: (r.recurring as PaymentSchedule['recurring']) || DEFAULT_PAYMENT_SCHEDULE.recurring,
    };
  }

  return { ...DEFAULT_PAYMENT_SCHEDULE };
}

export type ProposalPricing = {
  id: string;
  proposal_id: string;
  company_id: string;
  enabled: boolean;
  position: number;
  title: string;
  intro_text: string | null;
  items: PricingLineItem[];
  optional_items: PricingOptionalItem[];
  payment_schedule: PaymentSchedule | null;
  tax_enabled: boolean;
  tax_rate: number;
  tax_label: string;
  validity_days: number | null;
  indent: number;
  proposal_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplatePricing = Omit<ProposalPricing, 'proposal_id' | 'proposal_date'> & {
  template_id: string;
};

/** Helper: compute subtotal from line items */
export function pricingSubtotal(items: PricingLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** Helper: compute tax amount */
export function pricingTax(subtotal: number, rate: number): number {
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

/** Helper: format AUD currency */
export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Helper: generate a short unique id for line items */
export function generateItemId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Helper: calculate the dollar amount for a milestone payment */
export function milestoneAmount(payment: MilestonePayment, projectTotal: number): number {
  if (payment.type === 'fixed') return payment.value;
  return Math.round(projectTotal * (payment.value / 100) * 100) / 100;
}

/** Helper: sum of all milestone percentages */
export function milestoneTotalPercent(payments: MilestonePayment[]): number {
  return payments
    .filter((p) => p.type === 'percentage')
    .reduce((sum, p) => sum + p.value, 0);
}

/** Helper: sum of all milestone fixed amounts */
export function milestoneTotalFixed(payments: MilestonePayment[]): number {
  return payments
    .filter((p) => p.type === 'fixed')
    .reduce((sum, p) => sum + p.value, 0);
}

// Individual feature within a package
export type PackageFeature = {
  text: string;             // Main feature text e.g. "Funnel management to optimise..."
  bold_prefix: string | null; // Optional bold lead-in e.g. "Funnel management" (null = no bold)
  children: string[];       // Nested sub-features e.g. under "Local SEO"
};

// A single package/tier
export type PackageTier = {
  id: string;
  name: string;
  price: number;
  price_prefix: string;
  price_suffix: string;
  is_recommended: boolean;
  highlight_color: string | null;       // Override accent color for this tier
  conditions: string[];
  features: PackageFeature[];
  sort_order: number;
  card_bg_color?: string | null;        // Per-tier card background
  card_text_color?: string | null;      // Per-tier card text color
};

// Full packages record for a proposal
export type ProposalPackages = {
  id: string;
  proposal_id: string;
  company_id: string;
  enabled: boolean;
  position: number;
  indent: number;
  title: string;
  intro_text: string | null;
  packages: PackageTier[];
  footer_text: string | null;
  styling: PackageStyling;            
  created_at: string;
  updated_at: string;
};

export const DEFAULT_PACKAGE_TIER_UPDATED: Omit<PackageTier, 'id' | 'sort_order'> = {
  name: 'Package Name',
  price: 0,
  price_prefix: 'FROM',
  price_suffix: '/month',
  is_recommended: false,
  highlight_color: null,
  conditions: [],
  features: [],
  card_bg_color: null,
  card_text_color: null,
};



// Template variant (same shape minus proposal-specific fields)
export type TemplatePackages = Omit<ProposalPackages, 'proposal_id'> & {
  template_id: string;
};

export const DEFAULT_PACKAGE_TIER: Omit<PackageTier, 'id' | 'sort_order'> = {
  name: 'Package Name',
  price: 0,
  price_prefix: 'FROM',
  price_suffix: '/month',
  is_recommended: false,
  highlight_color: null,
  conditions: [],
  features: [],
};

// ─── Table of Contents ───────────────────────────────────────────────────────

// Table of Contents settings (stored as JSONB on proposals, documents, templates)
export type TocSettings = {
  enabled: boolean;
  title: string;             // e.g. "Table of Contents"
  position: number;          // 0 = before first page, N = after PDF page N, -1 = after last page
  excluded_items: string[];  // identifiers of pages to EXCLUDE from the TOC
  // Identifiers follow the format:
  //   "pdf:3"       → PDF page 3 (1-indexed)
  //   "text:uuid"   → text page by ID
  //   "pricing"     → pricing page
  //   "packages"    → packages page
  //   "group:name"  → section group header
};

export const DEFAULT_TOC_SETTINGS: TocSettings = {
  enabled: false,
  title: 'Table of Contents',
  position: 0,
  excluded_items: [],
};

/** Parse toc_settings from DB JSONB into typed TocSettings */
export function parseTocSettings(raw: unknown): TocSettings {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      enabled: typeof obj.enabled === 'boolean' ? obj.enabled : false,
      title: typeof obj.title === 'string' ? obj.title : 'Table of Contents',
      position: typeof obj.position === 'number' ? obj.position : 0,
      excluded_items: Array.isArray(obj.excluded_items) ? obj.excluded_items : [],
    };
  }
  return { ...DEFAULT_TOC_SETTINGS };
}

export type PackageStyling = {
  title_color: string | null;          
  card_bg_color: string | null; 
  card_bg_independent: boolean;       
  card_text_color: string | null;       
  card_text_independent: boolean; 
  recommended_text_color: string | null; 
  recommended_bg_color: string | null;  
  feature_icon: PackageFeatureIcon;
  border_radius: number;               
  border_width: number;   
};

export const DEFAULT_PACKAGE_STYLING: PackageStyling = {
  title_color: null,
  card_bg_color: null,
  card_bg_independent: false,
  card_text_color: null,
  card_text_independent: false,
  recommended_text_color: null,
  recommended_bg_color: null,
  feature_icon: 'dot',
  border_radius: 12,
  border_width: 1,
};

/** Normalize styling from DB, filling in defaults for any missing keys */
export function normalizePackageStyling(raw: unknown): PackageStyling {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PACKAGE_STYLING };
  const r = raw as Record<string, unknown>;
  return {
    title_color: (r.title_color as string) ?? null,
    card_bg_color: (r.card_bg_color as string) ?? null,
    card_bg_independent: !!(r.card_bg_independent),
    card_text_color: (r.card_text_color as string) ?? null,
    card_text_independent: !!(r.card_text_independent),
    recommended_text_color: (r.recommended_text_color as string) ?? null,
    recommended_bg_color: (r.recommended_bg_color as string) ?? null,
    feature_icon: (['dot', 'check', 'checkCircle', 'arrow', 'star', 'dash'].includes(r.feature_icon as string)
      ? r.feature_icon as PackageFeatureIcon
      : 'dot'),
    border_radius: typeof r.border_radius === 'number' ? r.border_radius : 12,
    border_width: typeof r.border_width === 'number' ? r.border_width : 1,
  };
}

