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

  // Attribution setting (echoed from request)
  'attribution_setting',
]);
