// lib/proposal-templates/cover-presets.ts
// QuoteWin-style "Proposal Style" picker. A preset is a named bundle of
// cover_* field values that the builder writes to the proposal in one shot.
// Presets are intentionally static — no DB table — so they're cheap to add
// and survive across companies.

export type CoverPresetId =
  | 'classic-navy'
  | 'clean'
  | 'slate'
  | 'midnight'
  | 'custom-brand';

export interface CoverPresetFields {
  cover_bg_style: 'solid' | 'gradient';
  cover_bg_color_1: string;
  cover_bg_color_2: string;
  cover_gradient_type: 'linear' | 'radial' | 'conic';
  cover_gradient_angle: number;
  cover_text_color: string;
  cover_subtitle_color: string;
  cover_button_bg: string;
  cover_button_text_color: string;
}

export interface CoverPreset {
  id: CoverPresetId;
  label: string;
  /** Short caption under the label, e.g. "Professional", "Minimal". */
  caption: string;
  /** When true, fields come from company branding rather than the literals below. */
  fromCompanyBrand?: boolean;
  fields: CoverPresetFields;
}

export const COVER_PRESETS: CoverPreset[] = [
  {
    id: 'classic-navy',
    label: 'Classic Navy',
    caption: 'Professional',
    fields: {
      cover_bg_style: 'gradient',
      cover_bg_color_1: '#0a1f44',
      cover_bg_color_2: '#1e3a8a',
      cover_gradient_type: 'linear',
      cover_gradient_angle: 135,
      cover_text_color: '#ffffff',
      cover_subtitle_color: '#cbd5e1',
      cover_button_bg: '#ffffff',
      cover_button_text_color: '#0a1f44',
    },
  },
  {
    id: 'clean',
    label: 'Clean',
    caption: 'Minimal',
    fields: {
      cover_bg_style: 'solid',
      cover_bg_color_1: '#f8fafc',
      cover_bg_color_2: '#f8fafc',
      cover_gradient_type: 'linear',
      cover_gradient_angle: 0,
      cover_text_color: '#0f172a',
      cover_subtitle_color: '#475569',
      cover_button_bg: '#0f172a',
      cover_button_text_color: '#ffffff',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    caption: 'Corporate',
    fields: {
      cover_bg_style: 'gradient',
      cover_bg_color_1: '#1e293b',
      cover_bg_color_2: '#334155',
      cover_gradient_type: 'linear',
      cover_gradient_angle: 160,
      cover_text_color: '#ffffff',
      cover_subtitle_color: '#cbd5e1',
      cover_button_bg: '#ffffff',
      cover_button_text_color: '#1e293b',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    caption: 'Bold',
    fields: {
      cover_bg_style: 'gradient',
      cover_bg_color_1: '#0f0f10',
      cover_bg_color_2: '#1f2937',
      cover_gradient_type: 'linear',
      cover_gradient_angle: 145,
      cover_text_color: '#ffffff',
      cover_subtitle_color: '#9ca3af',
      cover_button_bg: '#14b8a6',
      cover_button_text_color: '#ffffff',
    },
  },
  {
    id: 'custom-brand',
    label: 'Custom Brand',
    caption: 'From your company',
    fromCompanyBrand: true,
    // Acts as a sentinel — the actual values are read from companies.bg_primary
    // / companies.cover_button_text etc. by the picker before saving.
    fields: {
      cover_bg_style: 'solid',
      cover_bg_color_1: '#0f0f0f',
      cover_bg_color_2: '#0f0f0f',
      cover_gradient_type: 'linear',
      cover_gradient_angle: 0,
      cover_text_color: '#ffffff',
      cover_subtitle_color: '#cbd5e1',
      cover_button_bg: '#ffffff',
      cover_button_text_color: '#0f0f0f',
    },
  },
];

export function getCoverPreset(id: CoverPresetId): CoverPreset | undefined {
  return COVER_PRESETS.find((p) => p.id === id);
}
