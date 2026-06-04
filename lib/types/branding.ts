// lib/types/branding.ts

import { hexToOklch, oklchToHex } from '@/lib/branding/color-math';

// ─── CompanyBranding ─────────────────────────────────────────────────────────

export type CompanyBranding = {
  name: string;
  logo_url: string | null;
  accent_color: string;
  website: string | null;
  bg_primary: string;
  bg_secondary: string;
  sidebar_text_color: string;
  accept_text_color: string;
  cover_bg_style: 'gradient' | 'solid';
  cover_bg_color_1: string;
  cover_bg_color_2: string;
  cover_text_color: string;
  cover_subtitle_color: string;
  cover_button_bg: string;
  cover_button_text: string;
  cover_overlay_opacity: number;
  cover_gradient_type: 'linear' | 'radial' | 'conic';
  cover_gradient_angle: number;
  font_heading: string | null;
  font_body: string | null;
  font_sidebar: string | null;
  font_heading_weight: string | null;
  font_heading_size: string | null;
  font_body_weight: string | null;
  font_sidebar_weight: string | null;
  /** Cover CTA button font family + weight. NULL = inherit font_heading. */
  font_button: string | null;
  font_button_weight: string | null;
  title_font_family: string | null;
  title_font_weight: string | null;
  title_font_size: string | null;
  /** CSS text-transform applied per-font. 'none' | 'uppercase' | 'lowercase' | 'capitalize'. */
  title_font_transform: string | null;
  font_heading_transform: string | null;
  font_body_transform: string | null;
  text_page_bg_color: string;
  text_page_text_color: string;
  text_page_heading_color: string | null;
  text_page_font_size: string;
  text_page_border_enabled: boolean;
  text_page_border_color: string | null;
  text_page_border_radius: string;
  text_page_layout: 'contained' | 'full';
  bg_image_url: string | null;
  bg_image_overlay_opacity: number;
  bg_image_blur: number;
  page_num_circle_color: string | null;
  page_num_text_color: string | null;
  /** Decision page surface colours. Null = inherit from text_page_* cascade. */
  decision_action_bg_color: string | null;
  decision_action_text_color: string | null;
  decision_action_heading_color: string | null;
  /** Accept-button background. Null = use heading colour. */
  decision_action_accent_color: string | null;
  /** Decline-button background. Null = hardcoded red. */
  decision_decline_button_color: string | null;
  /** Revision-button background. Null = use heading colour. */
  decision_revision_button_color: string | null;
  /** Checkbox accent colour. Null = browser default. */
  decision_checkbox_color: string | null;
  /** Proposal pricing-page colour overrides — fed from proposals.pricing_*.
   *  Null falls back to the sidebar_text_color / accent / text_page_* cascade
   *  the PricingPage uses today. */
  pricing_header_text_color: string | null;
  pricing_text_color: string | null;
  pricing_price_title_color: string | null;
  pricing_price_color: string | null;
  pricing_payment_schedule_name_color: string | null;
  pricing_payment_schedule_price_color: string | null;
  pricing_accent_bar_color: string | null;
  pricing_dot_color: string | null;
};

// ─── Color helpers ────────────────────────────────────────────────────────────

export { hexToRgba } from '@/lib/branding/color-math';

/** Derive a border color using OKLCH perceptual lightness. */
export function deriveBorderColor(bg: string): string {
  const lch = hexToOklch(bg);
  const dir = lch.L < 0.5 ? 1 : -1;
  return oklchToHex({ ...lch, L: lch.L + dir * 0.08 });
}

/** Derive a surface/card color using OKLCH perceptual lightness. */
export function deriveSurfaceColor(bgPrimary: string, _bgSecondary?: string): string {
  const lch = hexToOklch(bgPrimary);
  const dir = lch.L < 0.5 ? 1 : -1;
  return oklchToHex({ ...lch, L: lch.L + dir * 0.035 });
}
