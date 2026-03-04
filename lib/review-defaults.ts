// lib/review-defaults.ts

import { DEFAULT_BRANDING as BASE_BRANDING } from '@/lib/branding-defaults';
import type { CompanyBranding } from '@/hooks/useProposal';

export const DEFAULT_BRANDING: CompanyBranding = {
  ...BASE_BRANDING,
  accent_color: '#01434A',
  bg_primary: '#01434A',
  bg_secondary: '#017C87',
  cover_bg_color_1: '#01434A',
  cover_bg_color_2: '#017C87',
  cover_button_bg: '#017C87',
};

export const GUEST_STORAGE_KEY = 'review_guest_identity';