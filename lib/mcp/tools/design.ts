import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuth, unauthorized, txt, json, type McpServer } from '@/lib/mcp/types';

/* ─── camelCase → snake_case field map ──────────────────────────────────── */

const FIELD_MAP: [string, string][] = [
  // Cover settings
  ['coverEnabled', 'cover_enabled'], ['coverImagePath', 'cover_image_path'],
  ['coverSubtitle', 'cover_subtitle'], ['coverButtonText', 'cover_button_text'],
  ['coverBgStyle', 'cover_bg_style'], ['coverBgColor1', 'cover_bg_color_1'],
  ['coverBgColor2', 'cover_bg_color_2'], ['coverGradientType', 'cover_gradient_type'],
  ['coverGradientAngle', 'cover_gradient_angle'], ['coverGradientPositionX', 'cover_gradient_position_x'],
  ['coverGradientPositionY', 'cover_gradient_position_y'], ['coverGradientStops', 'cover_gradient_stops'],
  ['coverOverlayOpacity', 'cover_overlay_opacity'], ['coverTextColor', 'cover_text_color'],
  ['coverSubtitleColor', 'cover_subtitle_color'], ['coverButtonBg', 'cover_button_bg'],
  ['coverButtonTextColor', 'cover_button_text_color'], ['coverClientLogoPath', 'cover_client_logo_path'],
  ['coverClientLogoTintColor', 'cover_client_logo_tint_color'], ['coverAvatarPath', 'cover_avatar_path'],
  ['coverDate', 'cover_date'], ['coverShowClientLogo', 'cover_show_client_logo'],
  ['coverShowAvatar', 'cover_show_avatar'], ['coverShowDate', 'cover_show_date'],
  ['coverShowPreparedBy', 'cover_show_prepared_by'],
  // Background
  ['bgImagePath', 'bg_image_path'], ['bgImageOverlayOpacity', 'bg_image_overlay_opacity'],
  ['bgImageBlur', 'bg_image_blur'],
  // Typography
  ['titleFontFamily', 'title_font_family'], ['titleFontWeight', 'title_font_weight'],
  ['titleFontSize', 'title_font_size'], ['titleFontTransform', 'title_font_transform'],
  ['fontHeadingFamily', 'font_heading_family'], ['fontHeadingWeight', 'font_heading_weight'],
  ['fontHeadingSize', 'font_heading_size'], ['fontHeadingTransform', 'font_heading_transform'],
  ['fontBodyFamily', 'font_body_family'], ['fontBodyWeight', 'font_body_weight'],
  ['fontBodyTransform', 'font_body_transform'], ['fontButtonFamily', 'font_button_family'],
  ['fontButtonWeight', 'font_button_weight'],
  // Text page theming
  ['textPageBgColor', 'text_page_bg_color'], ['textPageTextColor', 'text_page_text_color'],
  ['textPageHeadingColor', 'text_page_heading_color'], ['textPageFontSize', 'text_page_font_size'],
  ['textPageBorderEnabled', 'text_page_border_enabled'], ['textPageBorderColor', 'text_page_border_color'],
  ['textPageBorderRadius', 'text_page_border_radius'], ['textPageLayout', 'text_page_layout'],
  // Page numbering
  ['pageNumCircleColor', 'page_num_circle_color'], ['pageNumTextColor', 'page_num_text_color'],
  // Quote/pricing page theming
  ['quotePageBgColor', 'quote_page_bg_color'],
  ['quoteHeaderBgColor1', 'quote_header_bg_color_1'], ['quoteHeaderBgColor2', 'quote_header_bg_color_2'],
  ['quoteHeaderTextColor', 'quote_header_text_color'], ['quoteHeaderSubtitleColor', 'quote_header_subtitle_color'],
  ['pricingHeaderTextColor', 'pricing_header_text_color'], ['pricingTextColor', 'pricing_text_color'],
  ['pricingPriceTitleColor', 'pricing_price_title_color'], ['pricingPriceColor', 'pricing_price_color'],
  ['pricingPaymentScheduleNameColor', 'pricing_payment_schedule_name_color'],
  ['pricingPaymentSchedulePriceColor', 'pricing_payment_schedule_price_color'],
  ['pricingAccentBarColor', 'pricing_accent_bar_color'], ['pricingDotColor', 'pricing_dot_color'],
  // Decision/accept page
  ['decisionActionBgColor', 'decision_action_bg_color'], ['decisionActionTextColor', 'decision_action_text_color'],
  ['decisionActionHeadingColor', 'decision_action_heading_color'],
  ['decisionActionAccentColor', 'decision_action_accent_color'],
  ['decisionDeclineButtonColor', 'decision_decline_button_color'],
  ['decisionRevisionButtonColor', 'decision_revision_button_color'],
  ['decisionCheckboxColor', 'decision_checkbox_color'],
  ['decisionPageEnabled', 'decision_page_enabled'], ['decisionPageTitle', 'decision_page_title'],
  ['decisionExtras', 'decision_extras'],
  // Post-accept
  ['postAcceptAction', 'post_accept_action'], ['postAcceptRedirectUrl', 'post_accept_redirect_url'],
  ['postAcceptMessage', 'post_accept_message'],
  // Other
  ['pageOrientation', 'page_orientation'], ['tocSettings', 'toc_settings'],
  ['packageStyling', 'package_styling'], ['preparedBy', 'prepared_by'],
  ['preparedByMemberId', 'prepared_by_member_id'],
];

/* ─── Shared Zod schema for design params ───────────────────────────────── */

const designParams = {
  // Cover
  coverEnabled: z.boolean().optional(), coverImagePath: z.string().optional(),
  coverSubtitle: z.string().optional(), coverButtonText: z.string().optional(),
  coverBgStyle: z.string().optional(), coverBgColor1: z.string().optional(),
  coverBgColor2: z.string().optional(), coverGradientType: z.string().optional(),
  coverGradientAngle: z.number().optional(), coverGradientPositionX: z.number().optional(),
  coverGradientPositionY: z.number().optional(), coverGradientStops: z.any().optional(),
  coverOverlayOpacity: z.number().optional(), coverTextColor: z.string().optional(),
  coverSubtitleColor: z.string().optional(), coverButtonBg: z.string().optional(),
  coverButtonTextColor: z.string().optional(), coverClientLogoPath: z.string().optional(),
  coverClientLogoTintColor: z.string().optional(), coverAvatarPath: z.string().optional(),
  coverDate: z.string().optional(), coverShowClientLogo: z.boolean().optional(),
  coverShowAvatar: z.boolean().optional(), coverShowDate: z.boolean().optional(),
  coverShowPreparedBy: z.boolean().optional(),
  // Background
  bgImagePath: z.string().optional(), bgImageOverlayOpacity: z.number().optional(),
  bgImageBlur: z.number().optional(),
  // Typography
  titleFontFamily: z.string().optional(), titleFontWeight: z.string().optional(),
  titleFontSize: z.string().optional(), titleFontTransform: z.string().optional(),
  fontHeadingFamily: z.string().optional(), fontHeadingWeight: z.string().optional(),
  fontHeadingSize: z.string().optional(), fontHeadingTransform: z.string().optional(),
  fontBodyFamily: z.string().optional(), fontBodyWeight: z.string().optional(),
  fontBodyTransform: z.string().optional(), fontButtonFamily: z.string().optional(),
  fontButtonWeight: z.string().optional(),
  // Text page theming
  textPageBgColor: z.string().optional(), textPageTextColor: z.string().optional(),
  textPageHeadingColor: z.string().optional(), textPageFontSize: z.string().optional(),
  textPageBorderEnabled: z.boolean().optional(), textPageBorderColor: z.string().optional(),
  textPageBorderRadius: z.string().optional(), textPageLayout: z.string().optional(),
  // Page numbering
  pageNumCircleColor: z.string().optional(), pageNumTextColor: z.string().optional(),
  // Quote/pricing page theming
  quotePageBgColor: z.string().optional(),
  quoteHeaderBgColor1: z.string().optional(), quoteHeaderBgColor2: z.string().optional(),
  quoteHeaderTextColor: z.string().optional(), quoteHeaderSubtitleColor: z.string().optional(),
  pricingHeaderTextColor: z.string().optional(), pricingTextColor: z.string().optional(),
  pricingPriceTitleColor: z.string().optional(), pricingPriceColor: z.string().optional(),
  pricingPaymentScheduleNameColor: z.string().optional(),
  pricingPaymentSchedulePriceColor: z.string().optional(),
  pricingAccentBarColor: z.string().optional(), pricingDotColor: z.string().optional(),
  // Decision/accept page
  decisionActionBgColor: z.string().optional(), decisionActionTextColor: z.string().optional(),
  decisionActionHeadingColor: z.string().optional(), decisionActionAccentColor: z.string().optional(),
  decisionDeclineButtonColor: z.string().optional(), decisionRevisionButtonColor: z.string().optional(),
  decisionCheckboxColor: z.string().optional(), decisionPageEnabled: z.boolean().optional(),
  decisionPageTitle: z.string().optional(), decisionExtras: z.any().optional(),
  // Post-accept
  postAcceptAction: z.string().optional(), postAcceptRedirectUrl: z.string().optional(),
  postAcceptMessage: z.string().optional(),
  // Other
  pageOrientation: z.string().optional(), tocSettings: z.any().optional(),
  packageStyling: z.any().optional(), preparedBy: z.string().optional(),
  preparedByMemberId: z.string().optional(),
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function buildUpdates(args: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const [camel, snake] of FIELD_MAP) {
    if (args[camel] !== undefined) updates[snake] = args[camel];
  }
  return updates;
}

const DESIGN_COLUMNS = FIELD_MAP.map(([, col]) => col).join(', ');

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function rowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    out[snakeToCamel(key)] = val;
  }
  return out;
}

/* ─── Registration ──────────────────────────────────────────────────────── */

export function registerDesignTools(server: McpServer) {

  // ── update_proposal_design ──────────────────────────────────────────────
  server.tool('update_proposal_design', 'Update visual design/branding fields on a proposal (colors, fonts, cover, decision page, etc).', {
    proposalId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
    ...designParams,
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: p } = await sb.from('proposals').select('id').eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (!p) return txt('Proposal not found');
    const updates = buildUpdates(args);
    if (Object.keys(updates).length === 0) return txt('No design fields provided.');
    updates.updated_at = new Date().toISOString();
    const { error } = await sb.from('proposals').update(updates).eq('id', args.proposalId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Proposal design updated (${Object.keys(updates).length - 1} fields).`);
  });

  // ── update_template_design ──────────────────────────────────────────────
  server.tool('update_template_design', 'Update visual design/branding fields on a template (colors, fonts, cover, decision page, etc).', {
    templateId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
    ...designParams,
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data: t } = await sb.from('proposal_templates').select('id').eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (!t) return txt('Template not found');
    const updates = buildUpdates(args);
    if (Object.keys(updates).length === 0) return txt('No design fields provided.');
    updates.updated_at = new Date().toISOString();
    const { error } = await sb.from('proposal_templates').update(updates).eq('id', args.templateId);
    if (error) return txt(`Failed: ${error.message}`);
    return txt(`Template design updated (${Object.keys(updates).length - 1} fields).`);
  });

  // ── get_proposal_design ─────────────────────────────────────────────────
  server.tool('get_proposal_design', 'Read all design/branding fields from a proposal.', {
    proposalId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('proposals')
      .select(`id, ${DESIGN_COLUMNS}`)
      .eq('id', args.proposalId).eq('company_id', auth.companyId).single();
    if (error || !data) return txt('Proposal not found');
    return json(rowToCamel(data as unknown as Record<string, unknown>));
  });

  // ── get_template_design ─────────────────────────────────────────────────
  server.tool('get_template_design', 'Read all design/branding fields from a template.', {
    templateId: z.string(),
    companyId: z.string().optional().describe('Super admin only: target a different company'),
  }, async (args, extra) => {
    const auth = getAuth(extra, args.companyId); if (!auth) return unauthorized();
    const sb = createServiceClient();
    const { data, error } = await sb.from('proposal_templates')
      .select(`id, ${DESIGN_COLUMNS}`)
      .eq('id', args.templateId).eq('company_id', auth.companyId).single();
    if (error || !data) return txt('Template not found');
    return json(rowToCamel(data as unknown as Record<string, unknown>));
  });
}
