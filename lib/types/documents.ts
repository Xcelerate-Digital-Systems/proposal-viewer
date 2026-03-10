// lib/types/documents.ts

import type { PageNameEntry } from './page-names';
import type { TocSettings } from './proposals';

// ─── Document ─────────────────────────────────────────────────────────────────

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
  page_orientation: 'portrait' | 'landscape';
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