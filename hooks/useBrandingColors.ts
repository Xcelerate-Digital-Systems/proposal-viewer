// hooks/useBrandingColors.ts
'use client';

import type { CompanyBranding } from '@/lib/types/branding';
import { useBrandPalette } from './useBrandPalette';

/**
 * Legacy hook — returns the 4 original color tokens for backward compat.
 * New code should use useBrandPalette() directly for the full 17-token palette.
 */
export function useBrandingColors(branding: CompanyBranding) {
  const palette = useBrandPalette(branding);
  return {
    bgSecondary: branding.bg_secondary || '#141414',
    accent: palette.accent,
    border: palette.border,
    sidebarText: palette.sidebarText,
    palette,
  };
}
