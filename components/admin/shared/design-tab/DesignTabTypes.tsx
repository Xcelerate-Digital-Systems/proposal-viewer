// components/admin/shared/design-tab/DesignTabTypes.tsx
import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type EntityType = 'proposal' | 'template' | 'document';
export type PageOrientation = 'auto' | 'portrait' | 'landscape';

export const tableByType: Record<EntityType, string> = {
  proposal: 'proposals',
  template: 'proposal_templates',
  document: 'documents',
};

export const storagePrefixByType: Record<EntityType, string> = {
  proposal: 'proposal',
  template: 'template',
  document: 'document',
};

/* ------------------------------------------------------------------ */
/*  Text page style defaults (match company table defaults)            */
/* ------------------------------------------------------------------ */

export interface TextPageDefaults {
  bg_color: string;
  text_color: string;
  heading_color: string;
  font_size: string;
  border_enabled: boolean;
  border_color: string;
  border_radius: string;
  accent_color: string;
  sidebar_text_color: string;
  bg_secondary: string;
  cover_text_color: string;
  cover_subtitle_color: string;
  font_heading: string | null;
  font_body: string | null;
}

export const FALLBACK_DEFAULTS: TextPageDefaults = {
  bg_color: '#141414',
  text_color: '#ffffff',
  heading_color: '',
  font_size: '14',
  border_enabled: true,
  border_color: '',
  border_radius: '12',
  accent_color: '#ff6700',
  sidebar_text_color: '#ffffff',
  bg_secondary: '#141414',
  cover_text_color: '#ffffff',
  cover_subtitle_color: '#ffffffb3',
  font_heading: null,
  font_body: null,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function isValidHex6(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

/* ------------------------------------------------------------------ */
/*  Orientation options                                                 */
/* ------------------------------------------------------------------ */

export const orientationOptions: { key: PageOrientation; label: string; icon: React.ReactNode }[] = [
  {
    key: 'auto',
    label: 'Auto (match PDF)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <path d="M8 5v6M5.5 7.5L8 5l2.5 2.5" />
      </svg>
    ),
  },
  {
    key: 'portrait',
    label: 'Portrait',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="1.5" width="9" height="13" rx="1.5" />
      </svg>
    ),
  },
  {
    key: 'landscape',
    label: 'Landscape',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Shared save status indicator                                        */
/* ------------------------------------------------------------------ */

export type SaveStatus = 'idle' | 'saving' | 'saved';