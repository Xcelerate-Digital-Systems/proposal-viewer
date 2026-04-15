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
export const ALLOWED_INSIGHT_FIELDS = new Set<string>([
  ...DEFAULT_INSIGHT_FIELDS,
  'date_start', 'date_stop',
  'objective', 'buying_type',
  'account_id', 'account_name', 'account_currency',
  'action_values',
  'cost_per_inline_link_click',
  'cost_per_unique_inline_link_click',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p100_watched_actions',
  'video_thruplay_watched_actions',
  'video_avg_time_watched_actions',
]);
