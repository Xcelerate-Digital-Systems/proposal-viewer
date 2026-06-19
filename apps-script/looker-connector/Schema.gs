// Schema.gs
//
// Field catalog for the AgencyViz Facebook Ads connector. Defined as data
// structures, not imperative field builder calls — adding a new conversion
// event takes one line, not twenty.
//
// Display names and descriptions track Meta's Ads Manager UI so values in a
// Looker Studio report line up with what users see in the Ads Manager column
// picker.
//
// Currency is AUD throughout. If you need USD/EUR/etc., fork this file per
// deployment — Looker Studio schemas can't vary currency per row.

var CC = function () { return DataStudioApp.createCommunityConnector(); };

// ── Dimensions ────────────────────────────────────────────────────────────
// `group` maps to Looker Studio's setGroup() — creates accordion sections
// in the field picker, matching the SyncWith-style layout.
var DIMENSIONS = [
  { id: 'date_start',        name: 'Date',                 type: 'YEAR_MONTH_DAY', group: 'Date & Time', desc: 'Reporting date (day grain). API: date_start.' },

  // Date rollups — derived client-side from date_start. No extra API call
  // required. Let agencies drag "Month" or "Week" into a pivot without
  // changing the underlying Date field's granularity.
  { id: 'year',              name: 'Year',                 type: 'YEAR',           group: 'Date & Time', desc: 'Year rollup (YYYY). Derived from date_start.' },
  { id: 'year_quarter',      name: 'Year-Quarter',         type: 'YEAR_QUARTER',   group: 'Date & Time', desc: 'Year + quarter (YYYYQ). Derived from date_start.' },
  { id: 'year_month',        name: 'Year-Month',           type: 'YEAR_MONTH',     group: 'Date & Time', desc: 'Year + month (YYYYMM). Derived from date_start.' },
  { id: 'year_week',         name: 'Year-Week (ISO)',      type: 'YEAR_WEEK',      group: 'Date & Time', desc: 'Year + ISO week (YYYYWW). Derived from date_start.' },
  { id: 'quarter',           name: 'Quarter',              type: 'QUARTER',        group: 'Date & Time', desc: 'Quarter (1-4). Derived from date_start.' },
  { id: 'month',              name: 'Month',               type: 'MONTH',          group: 'Date & Time', desc: 'Month number (01-12). Derived from date_start.' },
  { id: 'week',              name: 'Week (ISO)',           type: 'WEEK',           group: 'Date & Time', desc: 'ISO week number (01-53). Derived from date_start.' },
  { id: 'day',               name: 'Day of month',         type: 'DAY',            group: 'Date & Time', desc: 'Day of month (01-31). Derived from date_start.' },
  { id: 'day_of_week',       name: 'Day of week',          type: 'DAY_OF_WEEK',    group: 'Date & Time', desc: 'Day of week (0=Sunday … 6=Saturday). Derived from date_start.' },
  { id: 'week_of_month',     name: 'Week of month',        type: 'TEXT',           group: 'Date & Time', desc: 'Week bucket within the month: "Week 1" (days 1-7), "Week 2" (8-14), "Week 3" (15-21), "Week 4" (22-28), "Week 5" (29+). Derived from date_start.' },

  { id: 'account_id',        name: 'Account ID',           type: 'TEXT',  group: 'Account' },
  { id: 'account_name',      name: 'Account name',         type: 'TEXT',  group: 'Account' },
  { id: 'account_currency',  name: 'Account currency',     type: 'TEXT',  group: 'Account', desc: 'Currency code for the ad account (e.g. AUD, USD). API: account_currency.' },
  { id: 'campaign_id',       name: 'Campaign ID',          type: 'TEXT',  group: 'Campaign' },
  { id: 'campaign_name',     name: 'Campaign name',        type: 'TEXT',  group: 'Campaign' },
  { id: 'objective',         name: 'Campaign objective',   type: 'TEXT',  group: 'Campaign', desc: 'e.g. OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC.' },
  { id: 'buying_type',       name: 'Buying type',          type: 'TEXT',  group: 'Campaign', desc: 'AUCTION or RESERVED.' },
  { id: 'optimization_goal', name: 'Optimization goal',    type: 'TEXT',  group: 'Campaign' },
  { id: 'adset_id',          name: 'Ad set ID',            type: 'TEXT',  group: 'Ad Set' },
  { id: 'adset_name',        name: 'Ad set name',          type: 'TEXT',  group: 'Ad Set' },
  { id: 'ad_id',             name: 'Ad ID',                type: 'TEXT',  group: 'Ad' },
  { id: 'ad_name',           name: 'Ad name',              type: 'TEXT',  group: 'Ad' },
  { id: 'attribution_setting', name: 'Attribution setting', type: 'TEXT', group: 'Settings' },
];

// ── Breakdowns (conditionally registered based on config) ─────────────────
// When the user picks breakdowns in the connector config, Meta's /insights
// endpoint returns one row per (ad, date, *breakdown value*) combination.
// The breakdown value arrives under a key matching the breakdown name.
//
// `type` is the Looker field type for the value Meta returns:
//   - age:                  TEXT ("25-34", "45-54", ...)
//   - gender:               TEXT ("male" / "female" / "unknown")
//   - country:              COUNTRY_CODE (2-letter ISO) — enables maps in Looker
//   - publisher_platform:   TEXT ("facebook" / "instagram" / "messenger" / "audience_network")
//   - platform_position:    TEXT ("feed" / "story" / "reels" / ...)
//   - impression_device:    TEXT ("iphone" / "android_smartphone" / "desktop" / ...)
//   - hourly_stats_*:       TEXT ("00:00:00 - 00:59:59")
//
// Unknown or future breakdowns default to TEXT — Meta returns strings for
// every breakdown dimension, so this is safe.
var BREAKDOWN_DIMENSIONS = {
  age:                                                 { id: 'age',                                                 name: 'Age',                              type: 'TEXT',         group: 'Delivery' },
  gender:                                              { id: 'gender',                                              name: 'Gender',                           type: 'TEXT',         group: 'Delivery' },
  country:                                             { id: 'country',                                             name: 'Country',                          type: 'COUNTRY_CODE', group: 'Delivery' },
  region:                                              { id: 'region',                                              name: 'Region',                           type: 'TEXT',         group: 'Delivery' },
  dma:                                                 { id: 'dma',                                                 name: 'DMA (Designated Market Area)',     type: 'TEXT',         group: 'Delivery' },
  impression_device:                                   { id: 'impression_device',                                   name: 'Impression device',                type: 'TEXT',         group: 'Delivery' },
  device_platform:                                     { id: 'device_platform',                                     name: 'Device platform',                  type: 'TEXT',         group: 'Delivery' },
  publisher_platform:                                  { id: 'publisher_platform',                                  name: 'Publisher platform',               type: 'TEXT',         group: 'Delivery' },
  platform_position:                                   { id: 'platform_position',                                   name: 'Placement',                        type: 'TEXT',         group: 'Delivery' },
  hourly_stats_aggregated_by_advertiser_time_zone:     { id: 'hourly_stats_aggregated_by_advertiser_time_zone',     name: 'Hour (advertiser time zone)',      type: 'TEXT',         group: 'Date & Time' },
  hourly_stats_aggregated_by_audience_time_zone:       { id: 'hourly_stats_aggregated_by_audience_time_zone',       name: 'Hour (audience time zone)',        type: 'TEXT',         group: 'Date & Time' },
};

// ── Creative dimensions (hydrated from /ads, not /insights) ───────────────
// These aren't on the Meta insights endpoint — the Next.js API hydrates them
// per-ad via a secondary /act_X/ads?ids= batch fetch (see creatives.ts).
//
// IMAGE fields render inline in Looker tables (great for scorecards and
// thumbnail tiles). URL fields render as clickable links.
//
// Advantage+ creative pattern: primary fields show the first variant; _all
// variants are pipe-joined so agencies can see every rotation in one cell.
var CREATIVE_DIMENSIONS = [
  { id: 'ad_status',                    name: 'Ad status',                 type: 'TEXT',  group: 'Ad',               desc: 'Effective status: ACTIVE, PAUSED, DELETED, etc. API: effective_status.' },
  { id: 'ad_created_time',              name: 'Ad created time',           type: 'TEXT',  group: 'Ad',               desc: 'ISO 8601 timestamp when the ad was created. API: created_time.' },
  { id: 'ad_updated_time',              name: 'Ad updated time',           type: 'TEXT',  group: 'Ad',               desc: 'ISO 8601 timestamp of the last edit. API: updated_time.' },
  { id: 'ad_preview_url',               name: 'Ad preview link',           type: 'URL',   group: 'Ad',               desc: 'Shareable preview link to the ad in Ads Manager. API: preview_shareable_link.' },

  { id: 'ad_creative_id',               name: 'Creative ID',               type: 'TEXT',  group: 'Ad Creative Asset' },
  { id: 'ad_creative_name',             name: 'Creative name',             type: 'TEXT',  group: 'Ad Creative Asset' },
  { id: 'ad_creative_type',             name: 'Creative type',             type: 'TEXT',  group: 'Ad Creative Asset', desc: 'VIDEO, PHOTO, SHARE, etc. API: creative.object_type.' },
  { id: 'ad_thumbnail_url',             name: 'Ad preview',                type: 'URL',   group: 'Ad Creative Asset', desc: 'Meta-hosted preview image URL (works for image + video ads). API: creative.thumbnail_url. To render inline, create a calculated field: IMAGE(ad_thumbnail_url, "preview").' },
  { id: 'ad_image_url',                 name: 'Ad image URL',              type: 'URL',   group: 'Ad Creative Asset', desc: 'Full-size creative image URL. API: creative.image_url. To render inline, create a calculated field: IMAGE(ad_image_url, "image").' },
  { id: 'ad_video_id',                  name: 'Video ID',                  type: 'TEXT',  group: 'Ad Creative Asset', desc: 'Meta video asset id (for video ads). API: creative.video_id.' },
  { id: 'ad_instagram_permalink',       name: 'Instagram permalink',       type: 'URL',   group: 'Ad Creative Asset', desc: 'Public Instagram post URL (where applicable). API: creative.instagram_permalink_url.' },
  { id: 'ad_effective_object_story_id', name: 'Object story ID',           type: 'TEXT',  group: 'Ad Creative Asset', desc: 'Page/post id pair ({page_id}_{post_id}). API: creative.effective_object_story_id.' },

  { id: 'ad_primary_text',              name: 'Primary text',              type: 'TEXT',  group: 'Ad Creative',      desc: 'Main ad copy (body). First variant for Advantage+ ads.' },
  { id: 'ad_headline',                  name: 'Headline',                  type: 'TEXT',  group: 'Ad Creative',      desc: 'Ad headline (title). First variant for Advantage+ ads.' },
  { id: 'ad_description',               name: 'Description',               type: 'TEXT',  group: 'Ad Creative',      desc: 'Link description. First variant for Advantage+ ads.' },
  { id: 'ad_cta_type',                  name: 'CTA button',                type: 'TEXT',  group: 'Ad Creative',      desc: 'Call-to-action button type (e.g. LEARN_MORE, SHOP_NOW, BOOK_TRAVEL).' },
  { id: 'ad_destination_url',           name: 'Destination URL',           type: 'URL',   group: 'Ad Creative',      desc: 'The click-through URL (includes any tracking params).' },
  { id: 'ad_display_url',               name: 'Display URL',               type: 'TEXT',  group: 'Ad Creative',      desc: 'Caption / display URL shown in the ad (does not include tracking params).' },

  { id: 'ad_primary_text_all',          name: 'Primary text (all variants)', type: 'TEXT', group: 'Ad Dynamic Creative', desc: 'Every body variant for Advantage+ / dynamic creative, pipe-joined.' },
  { id: 'ad_headline_all',              name: 'Headline (all variants)',     type: 'TEXT', group: 'Ad Dynamic Creative', desc: 'Every headline variant for Advantage+ / dynamic creative, pipe-joined.' },
  { id: 'ad_description_all',           name: 'Description (all variants)',  type: 'TEXT', group: 'Ad Dynamic Creative', desc: 'Every description variant for Advantage+ / dynamic creative, pipe-joined.' },
  { id: 'ad_destination_url_all',       name: 'Destination URL (all variants)', type: 'TEXT', group: 'Ad Dynamic Creative', desc: 'Every destination URL for Advantage+ / dynamic creative, pipe-joined.' },
];

// ── Scalar metrics (a single number returned directly from Meta) ──────────
// Pairs of { id, name, type, agg, desc }. 'type' is one of
// NUMBER | PERCENT | CURRENCY_AUD. 'agg' is one of SUM | AVG.
//
// Rate metrics (CPM, CPC, CTR, cost-per-X) are *not* here — they live in
// RATE_METRICS below as formula-based calculated metrics. Declaring CPM as
// AVG looks right in a per-row table but collapses incorrectly in table
// totals and scorecards (Looker's default total is SUM), producing values
// in the thousands. Formula metrics let Looker aggregate the numerator and
// denominator independently before dividing — which is the weighted-average
// CPM Meta's Ads Manager shows.
var SCALAR_METRICS = [
  // Spend + delivery
  { id: 'spend',       name: 'Amount spent',       type: 'CURRENCY_AUD', agg: 'SUM', group: 'Delivery',    desc: 'Total amount spent on your ads. API: spend.' },
  { id: 'impressions', name: 'Impressions',        type: 'NUMBER',       agg: 'SUM', group: 'Delivery',    desc: 'Number of times your ads were on screen. API: impressions.' },
  { id: 'reach',       name: 'Reach',              type: 'NUMBER',       agg: 'SUM', group: 'Delivery',    desc: 'Number of people who saw your ads at least once. API: reach.' },

  // Clicks — scalar
  { id: 'clicks',                         name: 'Clicks (all)',                     type: 'NUMBER',       agg: 'SUM', group: 'Performance', desc: 'Every click on your ad. API: clicks.' },
  { id: 'unique_clicks',                  name: 'Unique clicks (all)',              type: 'NUMBER',       agg: 'SUM', group: 'Performance', desc: 'Unique people who clicked. API: unique_clicks.' },
  { id: 'inline_link_clicks',             name: 'Link clicks',                      type: 'NUMBER',       agg: 'SUM', group: 'Performance', desc: 'Clicks on ad links to destinations off Meta. API: inline_link_clicks.' },
  { id: 'unique_inline_link_clicks',      name: 'Unique link clicks',               type: 'NUMBER',       agg: 'SUM', group: 'Performance', desc: 'API: unique_inline_link_clicks.' },
  { id: 'outbound_clicks',                name: 'Outbound clicks',                  type: 'NUMBER',       agg: 'SUM', group: 'Performance', desc: 'Clicks on links that take people off Meta-owned properties. API: outbound_clicks.' },
  { id: 'unique_outbound_clicks',         name: 'Unique outbound clicks',           type: 'NUMBER',       agg: 'SUM', group: 'Performance', desc: 'API: unique_outbound_clicks.' },

  // Quality rankings (Meta returns as TEXT — ABOVE_AVERAGE, AVERAGE, etc.)
  { id: 'quality_ranking',           name: 'Quality ranking',           type: 'TEXT', agg: null, group: 'Settings', desc: 'Meta auction quality ranking. API: quality_ranking.' },
  { id: 'engagement_rate_ranking',   name: 'Engagement rate ranking',   type: 'TEXT', agg: null, group: 'Settings', desc: 'API: engagement_rate_ranking.' },
  { id: 'conversion_rate_ranking',   name: 'Conversion rate ranking',   type: 'TEXT', agg: null, group: 'Settings', desc: 'API: conversion_rate_ranking.' },

  // Estimated ad recall
  { id: 'estimated_ad_recallers',    name: 'Estimated ad recallers',    type: 'NUMBER',  agg: 'SUM', group: 'Engagement', desc: 'Estimated number of people likely to remember your ad if asked within 2 days. API: estimated_ad_recallers.' },
  { id: 'estimated_ad_recall_rate',  name: 'Estimated ad recall rate',  type: 'PERCENT', agg: 'AVG', group: 'Engagement', desc: 'Recallers as a percentage of reach. API: estimated_ad_recall_rate. Returned as a ratio (0.05 = 5%).' },

  // Instant Experience / Canvas
  { id: 'instant_experience_clicks_to_open',    name: 'Instant Experience opens',           type: 'NUMBER',  agg: 'SUM', group: 'Engagement', desc: 'Clicks to open the instant experience. API: instant_experience_clicks_to_open.' },
  { id: 'instant_experience_clicks_to_start',   name: 'Instant Experience interactions',    type: 'NUMBER',  agg: 'SUM', group: 'Engagement', desc: 'Clicks that triggered an interaction inside the instant experience. API: instant_experience_clicks_to_start.' },
  { id: 'instant_experience_outbound_clicks',   name: 'Instant Experience outbound clicks', type: 'NUMBER',  agg: 'SUM', group: 'Engagement', desc: 'Outbound clicks that originated from the instant experience. API: instant_experience_outbound_clicks.' },
  { id: 'canvas_avg_view_time',                 name: 'Canvas avg view time (seconds)',     type: 'NUMBER',  agg: 'AVG', group: 'Engagement', desc: 'Average time spent viewing the canvas. API: canvas_avg_view_time.' },
  { id: 'canvas_avg_view_percent',              name: 'Canvas avg view percent',            type: 'PERCENT', agg: 'AVG', group: 'Engagement', desc: 'Average percentage of the canvas viewed. API: canvas_avg_view_percent. Ratio (0.5 = 50%).' },
];

// ── Rate / ratio metrics (computed by Looker from scalar metrics above) ────
// Declared with setFormula so Looker aggregates the numerator and denominator
// across rows before dividing. This matches Meta Ads Manager's weighted
// averages and — critically — produces the right total in scorecards and
// table totals instead of summing per-row CPMs into the thousands.
//
// Formulas reference the ids declared in SCALAR_METRICS and the conversion
// event ids auto-generated by CONVERSION_EVENTS. CTR variants are ratios
// (0.05 = 5%), so the PERCENT type handles the display.
var RATE_METRICS = [
  { id: 'frequency',                         name: 'Frequency',                        type: 'NUMBER',       group: 'Delivery',    formula: 'SUM(impressions) / SUM(reach)',        desc: 'Average number of times each person saw your ad. Computed: impressions ÷ reach.' },
  { id: 'cpm',                               name: 'CPM (cost per 1,000 impressions)', type: 'CURRENCY_AUD', group: 'Delivery',    formula: 'SUM(spend) / SUM(impressions) * 1000', desc: 'Cost per 1,000 impressions. Computed: spend ÷ impressions × 1000.' },
  { id: 'cpp',                               name: 'CPP (cost per 1,000 reached)',     type: 'CURRENCY_AUD', group: 'Delivery',    formula: 'SUM(spend) / SUM(reach) * 1000',       desc: 'Cost per 1,000 people reached. Computed: spend ÷ reach × 1000.' },
  { id: 'cpc',                               name: 'CPC (all)',                        type: 'CURRENCY_AUD', group: 'Performance', formula: 'SUM(spend) / SUM(clicks)',             desc: 'Avg cost for each click (all). Computed: spend ÷ clicks.' },
  { id: 'cost_per_unique_click',             name: 'Cost per unique click',            type: 'CURRENCY_AUD', group: 'Performance', formula: 'SUM(spend) / SUM(unique_clicks)',                 desc: 'Computed: spend ÷ unique clicks.' },
  { id: 'cost_per_inline_link_click',        name: 'CPC (cost per link click)',        type: 'CURRENCY_AUD', group: 'Performance', formula: 'SUM(spend) / SUM(inline_link_clicks)',            desc: 'Computed: spend ÷ link clicks.' },
  { id: 'cost_per_unique_inline_link_click', name: 'Cost per unique link click',       type: 'CURRENCY_AUD', group: 'Performance', formula: 'SUM(spend) / SUM(unique_inline_link_clicks)',     desc: 'Computed: spend ÷ unique link clicks.' },
  { id: 'cost_per_outbound_click',           name: 'Cost per outbound click',          type: 'CURRENCY_AUD', group: 'Performance', formula: 'SUM(spend) / SUM(outbound_clicks)',               desc: 'Computed: spend ÷ outbound clicks.' },
  { id: 'cost_per_unique_outbound_click',    name: 'Cost per unique outbound click',   type: 'CURRENCY_AUD', group: 'Performance', formula: 'SUM(spend) / SUM(unique_outbound_clicks)',        desc: 'Computed: spend ÷ unique outbound clicks.' },

  { id: 'ctr',                               name: 'CTR (all)',                              type: 'PERCENT',      group: 'Performance', formula: 'SUM(clicks) / SUM(impressions)',                  desc: 'Click-through rate on all clicks. Computed: clicks ÷ impressions.' },
  { id: 'unique_ctr',                        name: 'Unique CTR (all)',                       type: 'PERCENT',      group: 'Performance', formula: 'SUM(unique_clicks) / SUM(reach)',                 desc: 'Percentage of people who saw your ad and clicked anywhere on it. Computed: unique clicks ÷ reach.' },
  { id: 'inline_link_click_ctr',             name: 'CTR (link click-through rate)',          type: 'PERCENT',      group: 'Performance', formula: 'SUM(inline_link_clicks) / SUM(impressions)',      desc: 'Computed: link clicks ÷ impressions.' },
  { id: 'unique_inline_link_click_ctr',      name: 'Unique link CTR',                        type: 'PERCENT',      group: 'Performance', formula: 'SUM(unique_inline_link_clicks) / SUM(reach)',     desc: 'Percentage of people who saw your ad and clicked a link. Computed: unique link clicks ÷ reach.' },
  { id: 'outbound_clicks_ctr',               name: 'Outbound CTR',                           type: 'PERCENT',      group: 'Performance', formula: 'SUM(outbound_clicks) / SUM(impressions)',         desc: 'Computed: outbound clicks ÷ impressions.' },
  { id: 'unique_outbound_clicks_ctr',        name: 'Unique outbound CTR',                    type: 'PERCENT',      group: 'Performance', formula: 'SUM(unique_outbound_clicks) / SUM(reach)',        desc: 'Percentage of people who saw your ad and clicked an outbound link. Computed: unique outbound clicks ÷ reach.' },

  // Agency/DR-standard derived metric, not a native Meta field. 3-second
  // video views ÷ impressions — how much of your audience made it past the
  // scroll. Meta's "video_view" action type = 3-second plays.
  { id: 'hook_rate',                         name: 'Hook rate',                              type: 'PERCENT',      group: 'Video',       formula: 'SUM(video_view_action) / SUM(impressions)',       desc: 'Share of impressions that became 3-second video views. Computed: 3-second video views ÷ impressions.' },
];

// ── Conversion / engagement events ────────────────────────────────────────
// For each entry we auto-generate:
//   {id}                    — count        (from `actions`)              NUMBER SUM
//   {id}_value              — value        (from `action_values`)        CURRENCY_AUD SUM   [only if hasValue]
//   cost_per_{id}           — cost/event   (formula: spend / count)      CURRENCY_AUD
//   unique_{id}             — unique count (from `unique_actions`)       NUMBER SUM         [skipped if uniqueDeprecated]
//   cost_per_unique_{id}    — cost/unique  (formula: spend / unique)     CURRENCY_AUD       [skipped if uniqueDeprecated]
//
// `types` is searched in priority order. First match wins per row — Meta
// fires variants (offsite_conversion.fb_pixel_* / omni_* / plain) for the
// same user action depending on tracking source.
//
// `uniqueDeprecated: true` flags events whose unique_actions entry was
// retired by Meta on 30 Oct 2024 and now returns null. We skip emitting
// unique_/cost_per_unique_ fields for those so the picker stays clean.
// See: https://developers.facebook.com/docs/marketing-api/changelog
var CONVERSION_EVENTS = [
  // E-commerce
  { id: 'purchase',           label: 'Purchase',            hasValue: true,  uniqueDeprecated: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_web_purchase', 'onsite_web_app_purchase'] },
  { id: 'add_to_cart',        label: 'Add to cart',         hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart', 'add_to_cart'] },
  { id: 'initiate_checkout',  label: 'Checkout initiated',  hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_initiate_checkout', 'omni_initiated_checkout', 'initiate_checkout'] },
  { id: 'add_to_wishlist',    label: 'Add to wishlist',     hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_add_to_wishlist', 'omni_add_to_wishlist', 'add_to_wishlist'] },
  { id: 'add_payment_info',   label: 'Payment info added',  hasValue: false, group: 'Conversions', types: ['offsite_conversion.fb_pixel_add_payment_info', 'omni_add_payment_info', 'add_payment_info'] },
  { id: 'view_content',       label: 'Content view',        hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_view_content', 'omni_view_content', 'view_content'] },
  { id: 'search',             label: 'Search',              hasValue: false, uniqueDeprecated: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_search', 'omni_search', 'search'] },
  { id: 'customize_product',  label: 'Product customised',  hasValue: false, group: 'Conversions', types: ['offsite_conversion.fb_pixel_customize_product', 'customize_product'] },

  // Lead / sign-up
  { id: 'lead',               label: 'Lead',                hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'omni_lead', 'lead'] },
  { id: 'complete_registration', label: 'Registration completed', hasValue: true, uniqueDeprecated: true, group: 'Conversions', types: ['offsite_conversion.fb_pixel_complete_registration', 'omni_complete_registration', 'complete_registration'] },
  { id: 'submit_application', label: 'Application submitted', hasValue: false, group: 'Conversions', types: ['offsite_conversion.fb_pixel_submit_application', 'submit_application'] },
  { id: 'subscribe',          label: 'Subscribe',           hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_subscribe', 'subscribe'] },
  { id: 'start_trial',        label: 'Trial started',       hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_start_trial', 'omni_start_trial', 'start_trial'] },
  { id: 'contact',            label: 'Contact',             hasValue: false, group: 'Conversions', types: ['offsite_conversion.fb_pixel_contact', 'contact'] },
  { id: 'schedule',           label: 'Schedule',            hasValue: false, group: 'Conversions', types: ['offsite_conversion.fb_pixel_schedule', 'omni_schedule', 'schedule'] },
  { id: 'find_location',      label: 'Location found',      hasValue: false, group: 'Conversions', types: ['offsite_conversion.fb_pixel_find_location', 'find_location'] },
  { id: 'donate',             label: 'Donate',              hasValue: true,  group: 'Conversions', types: ['offsite_conversion.fb_pixel_donate', 'donate'] },
  { id: 'flow_complete',      label: 'Flow complete',       hasValue: false, group: 'Conversions', types: ['onsite_conversion.flow_complete'] },

  // Social / engagement (post-level)
  { id: 'landing_page_view',  label: 'Landing page view',   hasValue: false, uniqueDeprecated: true,  group: 'Engagement', types: ['landing_page_view'] },
  { id: 'post_engagement',    label: 'Post engagement',     hasValue: false, group: 'Engagement', types: ['post_engagement'] },
  { id: 'page_engagement',    label: 'Page engagement',     hasValue: false, group: 'Engagement', types: ['page_engagement'] },
  { id: 'post_reaction',      label: 'Post reaction',       hasValue: false, group: 'Engagement', types: ['post_reaction'] },
  { id: 'post_save',          label: 'Post save',           hasValue: false, group: 'Engagement', types: ['onsite_conversion.post_save'] },
  { id: 'photo_view',         label: 'Photo view',          hasValue: false, group: 'Engagement', types: ['photo_view'] },
  { id: 'link_click_action',  label: 'Link click (actions)', hasValue: false, group: 'Engagement', types: ['link_click'] },
  { id: 'page_like',          label: 'Page like',           hasValue: false, group: 'Engagement', types: ['like'] },
  { id: 'comment',            label: 'Comment',             hasValue: false, group: 'Engagement', types: ['comment'] },
  { id: 'rsvp',               label: 'Event RSVP',          hasValue: false, group: 'Engagement', types: ['rsvp'] },
  { id: 'checkin',            label: 'Check-in',            hasValue: false, group: 'Engagement', types: ['onsite_conversion.check_in'] },
  { id: 'achievement_unlocked', label: 'Achievement unlocked', hasValue: false, group: 'Engagement', types: ['achievement_unlocked', 'omni_achievement_unlocked'] },

  // Messaging
  { id: 'messaging_conversation_started',  label: 'Messaging conversation started',   hasValue: false, group: 'Messaging', types: ['onsite_conversion.messaging_conversation_started_7d'] },
  { id: 'messaging_connection',            label: 'Messaging connections',            hasValue: false, group: 'Messaging', types: ['onsite_conversion.total_messaging_connection'] },
  { id: 'messaging_first_reply',           label: 'Messaging first reply',            hasValue: false, group: 'Messaging', types: ['onsite_conversion.messaging_first_reply'] },
  { id: 'messaging_blocked',               label: 'Messaging blocked',                hasValue: false, group: 'Messaging', types: ['onsite_conversion.messaging_block'] },
  { id: 'messaging_welcome_message_view',  label: 'Messaging welcome message view',   hasValue: false, group: 'Messaging', types: ['onsite_conversion.messaging_welcome_message_view'] },
  { id: 'messaging_60s_plus_response',     label: 'Messaging 60s+ response',          hasValue: false, group: 'Messaging', types: ['onsite_conversion.messaging_60s_plus_response'] },

  // App events (high-level)
  { id: 'app_install',        label: 'App install',         hasValue: false, uniqueDeprecated: true,  group: 'App Events', types: ['mobile_app_install', 'app_install', 'omni_app_install'] },
  { id: 'app_activation',     label: 'App activation',      hasValue: false, uniqueDeprecated: true,  group: 'App Events', types: ['omni_activate_app', 'app_custom_event.fb_mobile_activate_app'] },

  // App events (granular — fb_mobile_* custom events)
  { id: 'app_add_to_cart',           label: 'App add to cart',             hasValue: true,  group: 'App Events', types: ['app_custom_event.fb_mobile_add_to_cart'] },
  { id: 'app_content_view',          label: 'App content view',            hasValue: true,  group: 'App Events', types: ['app_custom_event.fb_mobile_content_view'] },
  { id: 'app_search',                label: 'App search',                  hasValue: false, group: 'App Events', types: ['app_custom_event.fb_mobile_search'] },
  { id: 'app_initiate_checkout',     label: 'App initiated checkout',      hasValue: true,  group: 'App Events', types: ['app_custom_event.fb_mobile_initiated_checkout'] },
  { id: 'app_purchase',              label: 'App purchase',                hasValue: true,  group: 'App Events', types: ['app_custom_event.fb_mobile_purchase'] },
  { id: 'app_add_payment_info',      label: 'App added payment info',      hasValue: false, group: 'App Events', types: ['app_custom_event.fb_mobile_add_payment_info'] },
  { id: 'app_complete_registration', label: 'App registration completed',  hasValue: true,  group: 'App Events', types: ['app_custom_event.fb_mobile_complete_registration'] },
  { id: 'app_add_to_wishlist',       label: 'App add to wishlist',         hasValue: false, group: 'App Events', types: ['app_custom_event.fb_mobile_add_to_wishlist'] },
  { id: 'app_level_achieved',        label: 'App level achieved',          hasValue: false, uniqueDeprecated: true, group: 'App Events', types: ['app_custom_event.fb_mobile_level_achieved'] },
  { id: 'app_tutorial_completion',   label: 'App tutorial completion',     hasValue: false, uniqueDeprecated: true, group: 'App Events', types: ['app_custom_event.fb_mobile_tutorial_completion'] },
  { id: 'app_d1_retention',          label: 'App day 1 retention',         hasValue: false, group: 'App Events', types: ['app_custom_event.fb_mobile_d1_retention'] },

  // Video events (counted out of the `actions` array, not the dedicated
  // video_*_watched_actions fields — those are covered below).
  { id: 'video_view_action',  label: 'Video views (3 sec)', hasValue: false, group: 'Video', types: ['video_view'] },
];

// ── Video action-array metrics (separate top-level fields in the API) ─────
// These live in their own arrays (video_p25_watched_actions etc.) rather
// than inside `actions`. Each returns an array that typically has one entry
// whose `value` is the count we want.
var VIDEO_ACTION_METRICS = [
  { id: 'video_plays',            label: 'Video plays',                         from: 'video_play_actions',                    group: 'Video', desc: 'Total number of times your video played. API: video_play_actions.' },
  { id: 'video_p25_watches',      label: 'Video plays at 25%',                  from: 'video_p25_watched_actions',             group: 'Video', desc: 'API: video_p25_watched_actions.' },
  { id: 'video_p50_watches',      label: 'Video plays at 50%',                  from: 'video_p50_watched_actions',             group: 'Video', desc: 'API: video_p50_watched_actions.' },
  { id: 'video_p75_watches',      label: 'Video plays at 75%',                  from: 'video_p75_watched_actions',             group: 'Video', desc: 'API: video_p75_watched_actions.' },
  { id: 'video_p95_watches',      label: 'Video plays at 95%',                  from: 'video_p95_watched_actions',             group: 'Video', desc: 'API: video_p95_watched_actions.' },
  { id: 'video_p100_watches',     label: 'Video plays at 100%',                 from: 'video_p100_watched_actions',            group: 'Video', desc: 'API: video_p100_watched_actions.' },
  { id: 'video_thruplay_watches', label: 'ThruPlays',                           from: 'video_thruplay_watched_actions',        group: 'Video', desc: '15s+ or full length. API: video_thruplay_watched_actions.' },
  { id: 'video_15_sec_watches',   label: 'Video plays at 15 seconds',           from: 'video_15_sec_watched_actions',          group: 'Video', desc: 'API: video_15_sec_watched_actions.' },
  { id: 'video_30_sec_watches',   label: 'Video plays at 30 seconds',           from: 'video_30_sec_watched_actions',          group: 'Video', desc: 'API: video_30_sec_watched_actions.' },
  { id: 'video_continuous_2_sec_watches', label: 'Video plays (continuous 2s)', from: 'video_continuous_2_sec_watched_actions', group: 'Video', desc: 'API: video_continuous_2_sec_watched_actions.' },
  { id: 'video_avg_time_watched', label: 'Video average play time (seconds)',   from: 'video_avg_time_watched_actions',        group: 'Video', desc: 'API: video_avg_time_watched_actions.', agg: 'AVG' },
];

// ── ROAS metrics returned as action-typed arrays ──────────────────────────
var ROAS_METRICS = [
  { id: 'purchase_roas',            label: 'Purchase ROAS',            from: 'purchase_roas',            group: 'Conversions', types: ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'] },
  { id: 'website_purchase_roas',    label: 'Website purchase ROAS',    from: 'website_purchase_roas',    group: 'Conversions', types: ['offsite_conversion.fb_pixel_purchase', 'purchase'] },
  { id: 'mobile_app_purchase_roas', label: 'Mobile app purchase ROAS', from: 'mobile_app_purchase_roas', group: 'Conversions', types: ['app_custom_event.fb_mobile_purchase', 'mobile_app_purchase'] },
];

// ── Rate metrics pulled from action-typed arrays ──────────────────────────
// Some of Meta's rate fields (like website_ctr) are arrays keyed by
// action_type rather than a single scalar. We expose the relevant action
// entry directly — Looker aggregates as AVG, which matches Meta Ads
// Manager's "Auto" aggregation in the column picker.
var RATE_FROM_ACTION = [
  { id: 'website_link_click_ctr', label: 'CTR (link click-through rate)', from: 'website_ctr', types: ['link_click'], type: 'PERCENT', group: 'Performance', desc: 'Percentage of impressions that received a link click to a website. API: website_ctr; action_type=link_click. Ratio (0.05 = 5%).' },
];

// ── Catalog / dynamic product ads ─────────────────────────────────────────
// These return arrays keyed by action_type. We sum across all entries
// rather than picking one — agencies want the total across every product
// set by default. Use a breakdown to split by catalog if needed.
var PRODUCT_CATALOG_METRICS = [
  { id: 'catalog_segment_actions',   label: 'Catalog segment actions',   type: 'NUMBER',       from: 'catalog_segment_actions',   group: 'Catalog / Product Ads', desc: 'Sum of all catalog-linked actions (purchases, ATCs, views) from products advertised. API: catalog_segment_actions.' },
  { id: 'catalog_segment_value',     label: 'Catalog segment value',     type: 'CURRENCY_AUD', from: 'catalog_segment_value',     group: 'Catalog / Product Ads', desc: 'Total value of catalog-linked actions. API: catalog_segment_value.' },
  { id: 'converted_product_quantity', label: 'Converted product quantity', type: 'NUMBER',       from: 'converted_product_quantity', group: 'Catalog / Product Ads', desc: 'Number of products from your catalog that were purchased, added to cart, or viewed. API: converted_product_quantity.' },
  { id: 'converted_product_value',    label: 'Converted product value',    type: 'CURRENCY_AUD', from: 'converted_product_value',    group: 'Catalog / Product Ads', desc: 'Total value of products from your catalog that converted. API: converted_product_value.' },
];

// ─────────────────────────────────────────────────────────────────────────
// Field builder — turns the definitions above into a Looker Studio schema.
// ─────────────────────────────────────────────────────────────────────────

function getSchema(request) {
  return { schema: getFields().build() };
}

// Extract breakdown ids from a requested-field list. Meta's /insights
// endpoint changes row grain per breakdown, so we only request the
// breakdowns the user actually dragged into their chart. Fields picked
// from BREAKDOWN_DIMENSIONS become the `breakdowns=` param; everything
// else is a normal schema field.
function breakdownsFromFields(requestedFieldIds) {
  var out = [];
  for (var i = 0; i < requestedFieldIds.length; i++) {
    var id = requestedFieldIds[i];
    if (BREAKDOWN_DIMENSIONS[id]) out.push(id);
  }
  return out;
}

function getFields() {
  var cc = CC();
  var fields = cc.getFields();
  var T = cc.FieldType;
  var A = cc.AggregationType;

  DIMENSIONS.forEach(function (d) {
    var f = fields.newDimension().setId(d.id).setName(d.name).setType(T[d.type]);
    if (d.group) f.setGroup(d.group);
    if (d.desc) f.setDescription(d.desc);
  });

  // All breakdown dimensions are always available as fields. Meta only
  // actually splits rows when a breakdown is requested in getData — at
  // which point we pass `breakdowns=X` to /insights. Meta rejects some
  // combinations (e.g. hourly + demographic); those errors surface
  // verbatim to Looker Studio.
  Object.keys(BREAKDOWN_DIMENSIONS).forEach(function (id) {
    var d = BREAKDOWN_DIMENSIONS[id];
    var f = fields.newDimension().setId(d.id).setName(d.name).setType(T[d.type]);
    if (d.group) f.setGroup(d.group);
  });

  CREATIVE_DIMENSIONS.forEach(function (d) {
    var f = fields.newDimension().setId(d.id).setName(d.name).setType(T[d.type]);
    if (d.group) f.setGroup(d.group);
    if (d.desc) f.setDescription(d.desc);
  });

  SCALAR_METRICS.forEach(function (m) {
    var isQualityRank = m.agg === null;
    var f = isQualityRank
      ? fields.newDimension().setId(m.id).setName(m.name).setType(T.TEXT)
      : fields.newMetric().setId(m.id).setName(m.name).setType(T[m.type]).setAggregation(A[m.agg]);
    if (m.group) f.setGroup(m.group);
    if (m.desc) f.setDescription(m.desc);
  });

  RATE_METRICS.forEach(function (m) {
    var f = fields.newMetric()
      .setId(m.id)
      .setName(m.name)
      .setType(T[m.type])
      .setFormula(m.formula);
    if (m.group) f.setGroup(m.group);
    if (m.desc) f.setDescription(m.desc);
  });

  // For each conversion event: count + (optional) value + cost-per +
  // (if the unique variant isn't deprecated) unique_count + cost_per_unique.
  // cost_per_<id> and cost_per_unique_<id> are formula metrics so table
  // totals / scorecards divide aggregate spend by aggregate events rather
  // than summing per-row costs.
  CONVERSION_EVENTS.forEach(function (e) {
    var g = e.group;
    fields.newMetric()
      .setId(e.id)
      .setName(e.label)
      .setType(T.NUMBER)
      .setAggregation(A.SUM)
      .setGroup(g)
      .setDescription('Count of ' + e.label.toLowerCase() + ' events. API: actions; action_type matches one of: ' + e.types.join(', ') + '.');

    if (e.hasValue) {
      fields.newMetric()
        .setId(e.id + '_value')
        .setName(e.label + ' conversion value')
        .setType(T.CURRENCY_AUD)
        .setAggregation(A.SUM)
        .setGroup(g)
        .setDescription('Total monetary value of ' + e.label.toLowerCase() + ' events. API: action_values.');
    }

    fields.newMetric()
      .setId('cost_per_' + e.id)
      .setName('Cost per ' + e.label.toLowerCase())
      .setType(T.CURRENCY_AUD)
      .setFormula('SUM(spend) / SUM(' + e.id + ')')
      .setGroup(g)
      .setDescription('Computed: spend ÷ ' + e.label.toLowerCase() + ' events.');

    if (!e.uniqueDeprecated) {
      fields.newMetric()
        .setId('unique_' + e.id)
        .setName('Unique ' + e.label.toLowerCase())
        .setType(T.NUMBER)
        .setAggregation(A.SUM)
        .setGroup(g)
        .setDescription('Number of unique people who triggered a ' + e.label.toLowerCase() + ' event. API: unique_actions.');

      fields.newMetric()
        .setId('cost_per_unique_' + e.id)
        .setName('Cost per unique ' + e.label.toLowerCase())
        .setType(T.CURRENCY_AUD)
        .setFormula('SUM(spend) / SUM(unique_' + e.id + ')')
        .setGroup(g)
        .setDescription('Computed: spend ÷ unique ' + e.label.toLowerCase() + '.');
    }
  });

  VIDEO_ACTION_METRICS.forEach(function (v) {
    var agg = v.agg ? A[v.agg] : A.SUM;
    var f = fields.newMetric()
      .setId(v.id)
      .setName(v.label)
      .setType(T.NUMBER)
      .setAggregation(agg);
    if (v.group) f.setGroup(v.group);
    if (v.desc) f.setDescription(v.desc);
  });

  ROAS_METRICS.forEach(function (r) {
    var f = fields.newMetric()
      .setId(r.id)
      .setName(r.label)
      .setType(T.NUMBER)
      .setAggregation(A.AVG);
    if (r.group) f.setGroup(r.group);
    f.setDescription('Return on ad spend. API: ' + r.from + '.');
  });

  RATE_FROM_ACTION.forEach(function (r) {
    var f = fields.newMetric()
      .setId(r.id)
      .setName(r.label)
      .setType(T[r.type])
      .setAggregation(A.AVG);
    if (r.group) f.setGroup(r.group);
    if (r.desc) f.setDescription(r.desc);
  });

  PRODUCT_CATALOG_METRICS.forEach(function (p) {
    var f = fields.newMetric()
      .setId(p.id)
      .setName(p.label)
      .setType(T[p.type])
      .setAggregation(A.SUM);
    if (p.group) f.setGroup(p.group);
    if (p.desc) f.setDescription(p.desc);
  });

  return fields;
}

// ─────────────────────────────────────────────────────────────────────────
// Lookups used by Code.gs at query time.
// ─────────────────────────────────────────────────────────────────────────

// id → { from, types } for fields whose value lives inside an action-typed
// array. Built once from the declarations above.
var ACTION_FIELD_MAP = (function () {
  var map = {};
  CONVERSION_EVENTS.forEach(function (e) {
    map[e.id] = { from: 'actions', types: e.types };
    if (e.hasValue) {
      map[e.id + '_value'] = { from: 'action_values', types: e.types };
    }
    if (!e.uniqueDeprecated) {
      map['unique_' + e.id] = { from: 'unique_actions', types: e.types };
    }
  });
  ROAS_METRICS.forEach(function (r) {
    map[r.id] = { from: r.from, types: r.types };
  });
  RATE_FROM_ACTION.forEach(function (r) {
    map[r.id] = { from: r.from, types: r.types };
  });
  return map;
})();

// Set of field ids whose semantic type is PERCENT. Used by formatValue in
// Code.gs to avoid mangling ratio values (0–1 range) that Looker displays
// as percentages.
var PERCENT_FIELD_IDS = (function () {
  var set = {};
  RATE_METRICS.forEach(function (m) {
    if (m.type === 'PERCENT') set[m.id] = true;
  });
  RATE_FROM_ACTION.forEach(function (r) {
    if (r.type === 'PERCENT') set[r.id] = true;
  });
  // Scalar PERCENT metrics that arrive as ratios from Meta.
  SCALAR_METRICS.forEach(function (m) {
    if (m.type === 'PERCENT') set[m.id] = true;
  });
  return set;
})();

// Fields whose raw value is an array with one entry per action_type, but
// where we want the SUM of all entries (not a type-specific pick). Used
// for `video_*_watched_actions` and the `converted_product_*` / catalog
// segment families, which Meta returns as per-product-set breakdowns.
var VIDEO_SUM_FIELDS = (function () {
  var map = {};
  VIDEO_ACTION_METRICS.forEach(function (v) { map[v.id] = v.from; });
  PRODUCT_CATALOG_METRICS.forEach(function (p) { map[p.id] = p.from; });
  return map;
})();

// Set of creative dimension ids — used by formatValue / isNumericField to
// treat these as text-like (return '' on empty, skip numeric coercion) even
// though they aren't in the base DIMENSIONS list.
var CREATIVE_FIELD_IDS = (function () {
  var set = {};
  CREATIVE_DIMENSIONS.forEach(function (d) { set[d.id] = true; });
  return set;
})();

// Date rollup field ids — derived client-side from date_start. Code.gs
// needs to map these to the `date_start` API field (so we actually
// request it) and compute the rollup value per row.
var DATE_ROLLUP_FIELD_IDS = {
  year: true,
  year_quarter: true,
  year_month: true,
  year_week: true,
  quarter: true,
  month: true,
  week: true,
  day: true,
  day_of_week: true,
  week_of_month: true,
};
