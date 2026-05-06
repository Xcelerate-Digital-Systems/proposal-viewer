// lib/company-defaults.ts
// Shared helper for applying company-level cover + branding defaults when a
// new proposal / quote / document / template is created. Keeps inheritance
// logic in one place so every creation flow behaves the same.

import type { SupabaseClient } from '@supabase/supabase-js';

// Fields with the same name on `companies` and on the entity tables
// (proposals / proposal_templates / documents).
export const COMPANY_BRANDING_FIELDS = [
  'cover_bg_style',
  'cover_bg_color_1',
  'cover_bg_color_2',
  'cover_text_color',
  'cover_subtitle_color',
  'cover_button_bg',
  'cover_overlay_opacity',
  'cover_gradient_type',
  'cover_gradient_angle',
  'bg_image_path',
  'bg_image_overlay_opacity',
  'text_page_bg_color',
  'text_page_text_color',
  'text_page_heading_color',
  'text_page_font_size',
  'text_page_border_enabled',
  'text_page_border_color',
  'text_page_border_radius',
  'text_page_layout',
] as const;

// Fields whose column name differs between `companies` and the entity tables.
// On `companies`, `cover_button_text` stores the button TEXT COLOR. On
// entities the same value lives under `cover_button_text_color`, while the
// entity's `cover_button_text` column holds the button LABEL string.
const COMPANY_TO_ENTITY_FIELD_MAP: Record<string, string> = {
  cover_button_text: 'cover_button_text_color',
};

const COVER_IMAGE_FIELD = 'cover_image_path';

export interface CompanyDefaultsOptions {
  /** Caller-supplied values — never overridden. */
  overrides?: Record<string, unknown>;
}

/**
 * Reads the company's branding columns and returns the fields that should be
 * applied to a new entity. Caller-supplied `overrides` always win — only
 * undefined / null fields fall back to the company default.
 *
 * When the company has a `cover_image_path` set and the caller hasn't, we
 * also default `cover_enabled: true`, otherwise the inherited image would
 * never render in the public viewer.
 */
export async function getCompanyEntityDefaults(
  supabase: SupabaseClient,
  companyId: string,
  { overrides = {} }: CompanyDefaultsOptions = {},
): Promise<Record<string, unknown>> {
  const selectFields = [
    COVER_IMAGE_FIELD,
    ...COMPANY_BRANDING_FIELDS,
    ...Object.keys(COMPANY_TO_ENTITY_FIELD_MAP),
  ].join(', ');

  const { data, error } = await supabase
    .from('companies')
    .select(selectFields)
    .eq('id', companyId)
    .single();

  if (error || !data) return {};

  const company = data as unknown as Record<string, unknown>;
  const defaults: Record<string, unknown> = {};

  if (!overrides[COVER_IMAGE_FIELD] && company[COVER_IMAGE_FIELD]) {
    defaults[COVER_IMAGE_FIELD] = company[COVER_IMAGE_FIELD];
    if (overrides.cover_enabled === undefined) {
      defaults.cover_enabled = true;
    }
  }

  for (const field of COMPANY_BRANDING_FIELDS) {
    if (
      overrides[field] === undefined &&
      company[field] !== null &&
      company[field] !== undefined
    ) {
      defaults[field] = company[field];
    }
  }

  for (const [companyField, entityField] of Object.entries(COMPANY_TO_ENTITY_FIELD_MAP)) {
    if (
      overrides[entityField] === undefined &&
      company[companyField] !== null &&
      company[companyField] !== undefined
    ) {
      defaults[entityField] = company[companyField];
    }
  }

  return defaults;
}
