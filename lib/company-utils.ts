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
};
/**
 * Derive a border color by lightening the secondary bg.
 */
export function deriveBorder(bgSecondary: string): string {
  const hex = bgSecondary.replace('#', '');
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 22);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 22);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 22);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Derive a surface color between primary and secondary + small offset.
 */
export function deriveSurface(bgPrimary: string, bgSecondary: string): string {
  const p = bgPrimary.replace('#', '');
  const s = bgSecondary.replace('#', '');
  const r = Math.round((parseInt(p.slice(0, 2), 16) + parseInt(s.slice(0, 2), 16)) / 2 + 4);
  const g = Math.round((parseInt(p.slice(2, 4), 16) + parseInt(s.slice(2, 4), 16)) / 2 + 4);
  const b = Math.round((parseInt(p.slice(4, 6), 16) + parseInt(s.slice(4, 6), 16)) / 2 + 4);
  return `#${Math.min(255, r).toString(16).padStart(2, '0')}${Math.min(255, g).toString(16).padStart(2, '0')}${Math.min(255, b).toString(16).padStart(2, '0')}`;
}

/**
 * Convert a hex color to rgba for gradients / overlays.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const ACCENT_PRESETS = [
  '#ff6700', '#ef4444', '#f59e0b', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

export const BG_PRESETS = [
  { label: 'Midnight', primary: '#0f0f0f', secondary: '#141414' },
  { label: 'Charcoal', primary: '#1a1a1a', secondary: '#222222' },
  { label: 'Slate', primary: '#0f172a', secondary: '#1e293b' },
  { label: 'Navy', primary: '#0c1222', secondary: '#162032' },
  { label: 'Forest', primary: '#0a1410', secondary: '#121f19' },
  { label: 'Wine', primary: '#1a0a0f', secondary: '#261018' },
];

/** Validate a hex color string (6 or 8 digit) */
export function isValidHex6(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

export function isValidHex6or8(color: string): boolean {
  return /^#[0-9a-fA-F]{6,8}$/.test(color);
}