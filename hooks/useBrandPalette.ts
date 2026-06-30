// hooks/useBrandPalette.ts
'use client';

import { useMemo } from 'react';
import { generateBrandPalette, type BrandPalette } from '@/lib/branding';
import type { CompanyBranding } from '@/lib/types/branding';

/**
 * Generates a full semantic color palette from company branding using OKLCH.
 * Replaces useBrandingColors — returns 17 tokens instead of 4.
 */
export function useBrandPalette(branding: CompanyBranding): BrandPalette {
  return useMemo(
    () =>
      generateBrandPalette(
        branding.accent_color,
        branding.bg_primary,
        branding.bg_secondary,
        branding.sidebar_text_color,
        branding.accept_text_color,
        branding.bg_divider,
        branding.sidebar_inactive_text_color,
      ),
    [
      branding.accent_color,
      branding.bg_primary,
      branding.bg_secondary,
      branding.sidebar_text_color,
      branding.accept_text_color,
      branding.bg_divider,
      branding.sidebar_inactive_text_color,
    ],
  );
}
