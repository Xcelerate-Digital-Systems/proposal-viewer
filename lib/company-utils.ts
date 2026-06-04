// lib/company-utils.ts

export type CompanyData = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  logo_url: string | null;
  accent_color: string;
  bg_primary: string;
  bg_secondary: string;
  bg_divider: string | null;
  sidebar_text_color: string;
  accept_text_color: string;
  website: string | null;
  current_role: string;
  created_at: string;
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
  font_body_weight: string | null;
  font_sidebar_weight: string | null;
  text_page_bg_color?: string;
  text_page_text_color?: string;
  text_page_heading_color?: string | null;
  text_page_font_size?: string;
  text_page_border_enabled?: boolean;
  text_page_border_color?: string | null;
  text_page_border_radius?: string;
  text_page_layout?: 'contained' | 'full';
  bg_image_path: string | null;
  bg_image_overlay_opacity: number | null;
  brand_colors?: string[];
};
export { deriveBorderColor as deriveBorder, deriveSurfaceColor as deriveSurface } from '@/lib/types/branding';
export { hexToRgba } from '@/lib/branding/color-math';

export const ACCENT_PRESETS = [
  '#01434A', '#ef4444', '#f59e0b', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

export const BG_PRESETS = [
  { label: 'Midnight', primary: '#0f0f0f', secondary: '#141414' },
  { label: 'Charcoal', primary: '#1a1a1a', secondary: '#222222' },
  { label: 'Slate', primary: '#0f172a', secondary: '#1e293b' },
  { label: 'Navy', primary: '#0c1222', secondary: '#162032' },
  { label: 'Forest', primary: '#0a1410', secondary: '#121f19' },
  { label: 'Wine', primary: '#1a0a0f', secondary: '#261018' },
  { label: 'Snowdrift', primary: '#fafafa', secondary: '#ffffff' },
  { label: 'Stone', primary: '#f1f0ee', secondary: '#faf9f7' },
  { label: 'Cloud', primary: '#f0f4f8', secondary: '#f8fafc' },
  { label: 'Pearl', primary: '#f5f3ff', secondary: '#faf8ff' },
];

/** Validate a hex color string (6 or 8 digit) */
export function isValidHex6(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

export function isValidHex6or8(color: string): boolean {
  return /^#[0-9a-fA-F]{6,8}$/.test(color);
}