// Default Meta insights field catalog returned by the connector.
// Sourced from the Xcelerate warehouse (src/jobs/meta.js) — these fields are
// already known to work across the ad accounts we use internally.

export const META_API_VERSION = 'v21.0';

export const DEFAULT_INSIGHT_FIELDS = [
  'campaign_id', 'campaign_name',
  'adset_id', 'adset_name',
  'ad_id', 'ad_name',
  'impressions', 'clicks', 'spend', 'reach',
  'cpm', 'cpc', 'ctr',
  'actions', 'cost_per_action_type',
  'purchase_roas',
  'inline_link_clicks', 'inline_link_click_ctr',
  'unique_inline_link_clicks', 'unique_inline_link_click_ctr',
  'frequency',
  'video_play_actions',
] as const;

// Whitelist of fields the connector is allowed to request. Rejects everything
// else — protects against typos and against clients asking for expensive or
// privacy-sensitive fields (e.g. demographic breakdowns, which require extra
// Meta permissions and significantly change rate-limit cost).
//
// Organised by category to make auditing easier.
export const ALLOWED_INSIGHT_FIELDS = new Set<string>([
  // Identifiers / dimensions
  'campaign_id', 'campaign_name',
  'adset_id', 'adset_name',
  'ad_id', 'ad_name',
  'account_id', 'account_name', 'account_currency',
  'date_start', 'date_stop',
  'objective', 'buying_type', 'optimization_goal',

  // Spend + delivery
  'spend', 'impressions', 'reach', 'frequency',
  'cpm', 'cpp',

  // Clicks + CTR + CPC
  'clicks', 'unique_clicks',
  'inline_link_clicks', 'unique_inline_link_clicks',
  'outbound_clicks', 'unique_outbound_clicks',
  'cpc', 'cost_per_unique_click',
  'cost_per_inline_link_click', 'cost_per_unique_inline_link_click',
  'cost_per_outbound_click', 'cost_per_unique_outbound_click',
  'ctr', 'unique_ctr',
  'inline_link_click_ctr', 'unique_inline_link_click_ctr',
  'outbound_clicks_ctr', 'unique_outbound_clicks_ctr',

  // Action arrays — Apps Script extracts individual conversions out of these
  'actions', 'action_values',
  'unique_actions',
  'cost_per_action_type', 'cost_per_unique_action_type',
  'website_ctr',
  'purchase_roas', 'website_purchase_roas', 'mobile_app_purchase_roas',

  // Video
  'video_play_actions',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p95_watched_actions',
  'video_p100_watched_actions',
  'video_thruplay_watched_actions',
  'video_15_sec_watched_actions',
  'video_30_sec_watched_actions',
  'video_continuous_2_sec_watched_actions',
  'video_avg_time_watched_actions',
  'video_play_curve_actions',

  // Quality / auction
  'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
  'auction_bid', 'auction_competitiveness', 'auction_max_competitor_bid',

  // Estimated ad recall
  'estimated_ad_recallers', 'estimated_ad_recall_rate',

  // Instant Experience / Canvas
  'instant_experience_clicks_to_open',
  'instant_experience_clicks_to_start',
  'instant_experience_outbound_clicks',
  'canvas_avg_view_time',
  'canvas_avg_view_percent',

  // Catalog / dynamic product ads
  'catalog_segment_actions',
  'catalog_segment_value',
  'converted_product_quantity',
  'converted_product_value',

  // Attribution setting (echoed from request)
  'attribution_setting',
]);

// Creative / ad-copy fields. These are NOT valid /insights API fields —
// they're hydrated by a secondary /act_X/ads batch fetch (see creatives.ts)
// and merged into insights rows by ad_id. Keeping them in a separate set
// lets us reject unknown field names without passing them through to Meta.
export const ALLOWED_CREATIVE_FIELDS = new Set<string>([
  // Ad-level metadata
  'ad_status',
  'ad_created_time',
  'ad_updated_time',
  'ad_preview_url',

  // Creative identifiers + media
  'ad_creative_id',
  'ad_creative_name',
  'ad_creative_type',
  'ad_thumbnail_url',
  'ad_image_url',
  'ad_video_id',
  'ad_instagram_permalink',
  'ad_effective_object_story_id',

  // Ad copy — primary (first variant for Advantage+ ads)
  'ad_primary_text',
  'ad_headline',
  'ad_description',
  'ad_cta_type',
  'ad_destination_url',
  'ad_display_url',

  // Ad copy — all variants (pipe-joined for Advantage+ / dynamic creative)
  'ad_primary_text_all',
  'ad_headline_all',
  'ad_description_all',
  'ad_destination_url_all',
]);

// Breakdowns supported by the connector. Passed to Meta's /insights as
// `breakdowns=a,b,c`. Each breakdown changes row grain — rows come back
// split by the breakdown value, with that value under a key matching the
// breakdown name (e.g. `age: "25-34"`, `publisher_platform: "instagram"`).
//
// Meta rejects some combinations (e.g. hourly stats can't combine with
// demographic breakdowns). We don't pre-validate combinations — if Meta
// returns an error, it propagates cleanly to Looker Studio.
export const ALLOWED_BREAKDOWNS = new Set<string>([
  'age',
  'gender',
  'country',
  'region',
  'dma',
  'impression_device',
  'device_platform',
  'publisher_platform',
  'platform_position',
  'hourly_stats_aggregated_by_advertiser_time_zone',
  'hourly_stats_aggregated_by_audience_time_zone',
]);

export function validateBreakdowns(breakdowns: string[] | undefined): string[] {
  if (!breakdowns || breakdowns.length === 0) return [];
  const invalid = breakdowns.filter((b) => !ALLOWED_BREAKDOWNS.has(b));
  if (invalid.length > 0) {
    throw new Error(`Unsupported breakdowns: ${invalid.join(', ')}`);
  }
  // Dedup — harmless if caller already deduped, but defensive.
  return Array.from(new Set(breakdowns));
}

// Split + validate a requested field list. Creative fields are peeled off
// so they can be hydrated via /ads rather than /insights. Ensures ad_id is
// included in the insights request whenever creative fields are requested,
// since that's the join key.
export function splitAndValidateFields(
  requested: string[] | undefined,
): { insightFields: string[]; creativeFields: string[] } {
  if (!requested || requested.length === 0) {
    return { insightFields: [...DEFAULT_INSIGHT_FIELDS], creativeFields: [] };
  }
  const insightFields: string[] = [];
  const creativeFields: string[] = [];
  const invalid: string[] = [];
  for (const f of requested) {
    if (ALLOWED_CREATIVE_FIELDS.has(f)) creativeFields.push(f);
    else if (ALLOWED_INSIGHT_FIELDS.has(f)) insightFields.push(f);
    else invalid.push(f);
  }
  if (invalid.length > 0) {
    throw new Error(`Unsupported fields: ${invalid.join(', ')}`);
  }
  if (creativeFields.length > 0 && !insightFields.includes('ad_id')) {
    insightFields.push('ad_id');
  }
  return { insightFields, creativeFields };
}
