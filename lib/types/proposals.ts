// lib/types/proposals.ts

import type { PageNameEntry } from './page-names';

// ─── Table of Contents ────────────────────────────────────────────────────────

// Table of Contents settings (stored as JSONB on proposals, documents, templates)
export type TocSettings = {
  enabled: boolean;
  title: string;            // e.g. "Table of Contents"
  position: number;         // 0 = before first page, N = after PDF page N, -1 = after last page
  excluded_items: string[]; // identifiers of pages to EXCLUDE from the TOC
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

// ─── Page Order ───────────────────────────────────────────────────────────────

/**
 * One entry in the page_order JSONB array stored on proposals / proposal_templates.
 * Defines the exact sequence of all visible pages. NULL page_order = legacy fallback.
 */
export type PageOrderEntry =
  | { type: 'pdf' }
  | { type: 'pricing' }
  | { type: 'packages'; id: string } // id = proposal_packages / template_packages row
  | { type: 'text'; id: string }     // id = proposal_text_pages / template_text_pages row
  | { type: 'toc' };

/** Parse page_order JSONB from DB into PageOrderEntry[]. Returns null if missing/invalid. */
export function parsePageOrder(raw: unknown): PageOrderEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid: PageOrderEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = (item as Record<string, unknown>).type;
    if (t === 'pdf' || t === 'pricing' || t === 'toc') {
      valid.push({ type: t } as PageOrderEntry);
    } else if (
      (t === 'packages' || t === 'text') &&
      typeof (item as Record<string, unknown>).id === 'string'
    ) {
      valid.push({ type: t, id: (item as Record<string, unknown>).id as string } as PageOrderEntry);
    }
  }
  return valid.length > 0 ? valid : null;
}

// ─── Proposal ─────────────────────────────────────────────────────────────────

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
  bg_image_blur: number | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  page_orientation: 'portrait' | 'landscape';
  toc_settings: TocSettings | null;
  page_order: unknown;
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

// ─── Proposal Comment ─────────────────────────────────────────────────────────

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

// ─── Proposal Template ────────────────────────────────────────────────────────

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
  bg_image_blur: number | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  page_orientation: 'portrait' | 'landscape';
  toc_settings: TocSettings | null;
  page_order: unknown;
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
  post_accept_action: 'redirect' | 'message' | null;
  post_accept_redirect_url: string | null;
  post_accept_message: string | null;
};

// ─── Template Page ────────────────────────────────────────────────────────────

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