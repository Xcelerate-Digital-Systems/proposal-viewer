// hooks/useBrandingColors.ts
'use client';

import { useMemo } from 'react';
import { type CompanyBranding, deriveBorderColor } from '@/hooks/useProposal';

/**
 * Derives the commonly used color values from branding with proper fallbacks.
 * Replaces the identical 4-line block duplicated across every review page.
 */
export function useBrandingColors(branding: CompanyBranding) {
  return useMemo(() => ({
    bgSecondary: branding.bg_secondary || '#141414',
    accent: branding.accent_color || '#01434A',
    border: deriveBorderColor(branding.bg_secondary || '#141414'),
    sidebarText: branding.sidebar_text_color || '#ffffff',
  }), [branding.bg_secondary, branding.accent_color, branding.sidebar_text_color]);
}