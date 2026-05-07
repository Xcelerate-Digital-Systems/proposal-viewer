// lib/proposal-templates/cover-presets.ts
// QuoteWin-style "Proposal Style" picker. A preset is a named bundle of
// cover_* field values that the builder writes to the proposal in one shot.
// All presets ship with multi-stop gradients so the picker cards feel rich
// rather than flat blocks of colour.
//
// Custom Brand is resolved at apply-time from the company's branding row
// (accent_color + cover_button_*), not from these literals — those defaults
// are just a safety net if branding is unset.

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
  caption: string;
  /** When true, fields are resolved from the company's branding row. */
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
      cover_bg_color_2: '#3b6cb0',
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
      // Subtle off-white gradient — looks intentional rather than empty.
      cover_bg_style: 'gradient',
      cover_bg_color_1: '#ffffff',
      cover_bg_color_2: '#eef0f4',
      cover_gradient_type: 'linear',
      cover_gradient_angle: 145,
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
      cover_bg_color_2: '#64748b',
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
      cover_bg_color_2: '#3b3a52',
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
    // Sentinel only — the picker reads accent_color + cover_button_* from
    // the company row at apply-time and overrides these literals.
    fields: {
      cover_bg_style: 'gradient',
      cover_bg_color_1: '#1e293b',
      cover_bg_color_2: '#475569',
      cover_gradient_type: 'linear',
      cover_gradient_angle: 135,
      cover_text_color: '#ffffff',
      cover_subtitle_color: '#cbd5e1',
      cover_button_bg: '#ffffff',
      cover_button_text_color: '#1e293b',
    },
  },
];

export function getCoverPreset(id: CoverPresetId): CoverPreset | undefined {
  return COVER_PRESETS.find((p) => p.id === id);
}

/** Lighten a hex by a percentage (0–1). Naive but good enough for gradient seeds. */
function lighten(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
}

/** Resolve the Custom Brand preset against a company's branding row. */
export function resolveCustomBrand(
  base: CoverPresetFields,
  company: { accent_color?: string | null; cover_button_bg?: string | null; cover_button_text?: string | null },
): CoverPresetFields {
  const accent = company.accent_color || base.cover_bg_color_1;
  return {
    ...base,
    cover_bg_color_1: accent,
    cover_bg_color_2: lighten(accent, 0.35),
    cover_button_bg: company.cover_button_bg || '#ffffff',
    cover_button_text_color: company.cover_button_text || accent,
  };
}
