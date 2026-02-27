// lib/review-defaults.ts

import { type CompanyBranding } from '@/hooks/useProposal';

export const DEFAULT_BRANDING: CompanyBranding = {
  name: '', logo_url: null, accent_color: '#ff6700', website: null,
  bg_primary: '#0f0f0f', bg_secondary: '#141414',
  sidebar_text_color: '#ffffff', accept_text_color: '#ffffff',
  cover_bg_style: 'gradient', cover_bg_color_1: '#0f0f0f', cover_bg_color_2: '#141414',
  cover_text_color: '#ffffff', cover_subtitle_color: '#ffffffb3',
  cover_button_bg: '#ff6700', cover_button_text: '#ffffff',
  cover_overlay_opacity: 0.65, cover_gradient_type: 'linear', cover_gradient_angle: 135,
  font_heading: null, font_body: null, font_sidebar: null,
  font_heading_weight: null, font_body_weight: null, font_sidebar_weight: null,
  text_page_bg_color: '#141414', text_page_text_color: '#ffffff',
  text_page_heading_color: null, text_page_font_size: '14',
  text_page_border_enabled: true, text_page_border_color: null,
  text_page_border_radius: '12', text_page_layout: 'contained',
};

export const GUEST_STORAGE_KEY = 'review_guest_identity';