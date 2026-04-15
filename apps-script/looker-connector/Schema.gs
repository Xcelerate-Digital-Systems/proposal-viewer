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
var DIMENSIONS = [
  { id: 'date_start',        name: 'Date',                 type: 'YEAR_MONTH_DAY', desc: 'Reporting date (day grain). API: date_start.' },
  { id: 'account_id',        name: 'Account ID',           type: 'TEXT' },
  { id: 'account_name',      name: 'Account name',         type: 'TEXT' },
  { id: 'campaign_id',       name: 'Campaign ID',          type: 'TEXT' },
  { id: 'campaign_name',     name: 'Campaign name',        type: 'TEXT' },
  { id: 'objective',         name: 'Campaign objective',   type: 'TEXT', desc: 'e.g. OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC.' },
  { id: 'buying_type',       name: 'Buying type',          type: 'TEXT', desc: 'AUCTION or RESERVED.' },
  { id: 'optimization_goal', name: 'Optimization goal',    type: 'TEXT' },
  { id: 'adset_id',          name: 'Ad set ID',            type: 'TEXT' },
  { id: 'adset_name',        name: 'Ad set name',          type: 'TEXT' },
  { id: 'ad_id',             name: 'Ad ID',                type: 'TEXT' },
  { id: 'ad_name',           name: 'Ad name',              type: 'TEXT' },
  { id: 'attribution_setting', name: 'Attribution setting', type: 'TEXT' },
];

// ── Scalar metrics (a single number returned directly from Meta) ──────────
// Pairs of { id, name, type, agg, desc }. 'type' is one of
// NUMBER | PERCENT | CURRENCY_AUD. 'agg' is one of SUM | AVG.
var SCALAR_METRICS = [
  // Spend + delivery
  { id: 'spend',       name: 'Amount spent (AUD)', type: 'CURRENCY_AUD', agg: 'SUM', desc: 'Total amount spent on your ads. API: spend.' },
  { id: 'impressions', name: 'Impressions',        type: 'NUMBER',       agg: 'SUM', desc: 'Number of times your ads were on screen. API: impressions.' },
  { id: 'reach',       name: 'Reach',              type: 'NUMBER',       agg: 'SUM', desc: 'Number of people who saw your ads at least once. API: reach.' },
  { id: 'frequency',   name: 'Frequency',          type: 'NUMBER',       agg: 'AVG', desc: 'Average number of times each person saw your ad. API: frequency.' },
  { id: 'cpm',         name: 'CPM (cost per 1,000 impressions) (AUD)', type: 'CURRENCY_AUD', agg: 'AVG', desc: 'Avg cost per 1,000 impressions. API: cpm.' },
  { id: 'cpp',         name: 'CPP (cost per 1,000 reached)',           type: 'CURRENCY_AUD', agg: 'AVG', desc: 'Avg cost per 1,000 people reached. API: cpp.' },

  // Clicks — scalar
  { id: 'clicks',                         name: 'Clicks (all)',                     type: 'NUMBER',       agg: 'SUM', desc: 'Every click on your ad. API: clicks.' },
  { id: 'unique_clicks',                  name: 'Unique clicks (all)',              type: 'NUMBER',       agg: 'SUM', desc: 'Unique people who clicked. API: unique_clicks.' },
  { id: 'inline_link_clicks',             name: 'Link clicks',                      type: 'NUMBER',       agg: 'SUM', desc: 'Clicks on ad links to destinations off Meta. API: inline_link_clicks.' },
  { id: 'unique_inline_link_clicks',      name: 'Unique link clicks',               type: 'NUMBER',       agg: 'SUM', desc: 'API: unique_inline_link_clicks.' },
  { id: 'outbound_clicks',                name: 'Outbound clicks',                  type: 'NUMBER',       agg: 'SUM', desc: 'Clicks on links that take people off Meta-owned properties. API: outbound_clicks.' },
  { id: 'unique_outbound_clicks',         name: 'Unique outbound clicks',           type: 'NUMBER',       agg: 'SUM', desc: 'API: unique_outbound_clicks.' },

  // CPC
  { id: 'cpc',                               name: 'CPC (all) (AUD)',                 type: 'CURRENCY_AUD', agg: 'AVG', desc: 'Avg cost for each click (all). API: cpc.' },
  { id: 'cost_per_unique_click',             name: 'Cost per unique click (AUD)',     type: 'CURRENCY_AUD', agg: 'AVG', desc: 'API: cost_per_unique_click.' },
  { id: 'cost_per_inline_link_click',        name: 'CPC (cost per link click) (AUD)', type: 'CURRENCY_AUD', agg: 'AVG', desc: 'API: cost_per_inline_link_click.' },
  { id: 'cost_per_unique_inline_link_click', name: 'Cost per unique link click (AUD)', type: 'CURRENCY_AUD', agg: 'AVG', desc: 'API: cost_per_unique_inline_link_click.' },
  { id: 'cost_per_outbound_click',           name: 'Cost per outbound click (AUD)',   type: 'CURRENCY_AUD', agg: 'AVG', desc: 'API: cost_per_outbound_click.' },
  { id: 'cost_per_unique_outbound_click',    name: 'Cost per unique outbound click (AUD)', type: 'CURRENCY_AUD', agg: 'AVG', desc: 'API: cost_per_unique_outbound_click.' },

  // CTR
  { id: 'ctr',                           name: 'CTR (all)',                     type: 'PERCENT', agg: 'AVG', desc: 'Click-through rate on all clicks. = clicks ÷ impressions. API: ctr.' },
  { id: 'unique_ctr',                    name: 'Unique CTR (all)',              type: 'PERCENT', agg: 'AVG', desc: 'Unique click-through rate (all). API: unique_ctr.' },
  { id: 'inline_link_click_ctr',         name: 'CTR (link click-through rate)', type: 'PERCENT', agg: 'AVG', desc: 'Link CTR. = link clicks ÷ impressions. API: inline_link_click_ctr.' },
  { id: 'unique_inline_link_click_ctr',  name: 'Unique link CTR',               type: 'PERCENT', agg: 'AVG', desc: 'API: unique_inline_link_click_ctr.' },
  { id: 'outbound_clicks_ctr',           name: 'Outbound CTR',                  type: 'PERCENT', agg: 'AVG', desc: 'API: outbound_clicks_ctr.' },
  { id: 'unique_outbound_clicks_ctr',    name: 'Unique outbound CTR',           type: 'PERCENT', agg: 'AVG', desc: 'API: unique_outbound_clicks_ctr.' },

  // Quality rankings (Meta returns as TEXT — ABOVE_AVERAGE, AVERAGE, etc.)
  { id: 'quality_ranking',           name: 'Quality ranking',           type: 'TEXT', agg: null, desc: 'Meta auction quality ranking. API: quality_ranking.' },
  { id: 'engagement_rate_ranking',   name: 'Engagement rate ranking',   type: 'TEXT', agg: null, desc: 'API: engagement_rate_ranking.' },
  { id: 'conversion_rate_ranking',   name: 'Conversion rate ranking',   type: 'TEXT', agg: null, desc: 'API: conversion_rate_ranking.' },
];

// ── Conversion / engagement events ────────────────────────────────────────
// For each entry we auto-generate:
//   {id}              — count      (from `actions`)              NUMBER SUM
//   {id}_value        — value      (from `action_values`)        CURRENCY_AUD SUM   [only if hasValue]
//   cost_per_{id}     — cost/event (from `cost_per_action_type`) CURRENCY_AUD AVG
//
// `types` is searched in priority order. First match wins per row — Meta
// fires variants (offsite_conversion.fb_pixel_* / omni_* / plain) for the
// same user action depending on tracking source.
var CONVERSION_EVENTS = [
  // E-commerce
  { id: 'purchase',           label: 'Purchase',            hasValue: true,  types: ['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_web_purchase', 'onsite_web_app_purchase'] },
  { id: 'add_to_cart',        label: 'Add to cart',         hasValue: true,  types: ['offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart', 'add_to_cart'] },
  { id: 'initiate_checkout',  label: 'Checkout initiated',  hasValue: true,  types: ['offsite_conversion.fb_pixel_initiate_checkout', 'omni_initiated_checkout', 'initiate_checkout'] },
  { id: 'add_to_wishlist',    label: 'Add to wishlist',     hasValue: true,  types: ['offsite_conversion.fb_pixel_add_to_wishlist', 'omni_add_to_wishlist', 'add_to_wishlist'] },
  { id: 'add_payment_info',   label: 'Payment info added',  hasValue: false, types: ['offsite_conversion.fb_pixel_add_payment_info', 'omni_add_payment_info', 'add_payment_info'] },
  { id: 'view_content',       label: 'Content view',        hasValue: true,  types: ['offsite_conversion.fb_pixel_view_content', 'omni_view_content', 'view_content'] },
  { id: 'search',             label: 'Search',              hasValue: false, types: ['offsite_conversion.fb_pixel_search', 'omni_search', 'search'] },
  { id: 'customize_product',  label: 'Product customised',  hasValue: false, types: ['offsite_conversion.fb_pixel_customize_product', 'customize_product'] },

  // Lead / sign-up
  { id: 'lead',               label: 'Lead',                hasValue: true,  types: ['offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'omni_lead', 'lead'] },
  { id: 'complete_registration', label: 'Registration completed', hasValue: true, types: ['offsite_conversion.fb_pixel_complete_registration', 'omni_complete_registration', 'complete_registration'] },
  { id: 'submit_application', label: 'Application submitted', hasValue: false, types: ['offsite_conversion.fb_pixel_submit_application', 'submit_application'] },
  { id: 'subscribe',          label: 'Subscribe',           hasValue: true,  types: ['offsite_conversion.fb_pixel_subscribe', 'subscribe'] },
  { id: 'start_trial',        label: 'Trial started',       hasValue: true,  types: ['offsite_conversion.fb_pixel_start_trial', 'omni_start_trial', 'start_trial'] },
  { id: 'contact',            label: 'Contact',             hasValue: false, types: ['offsite_conversion.fb_pixel_contact', 'contact'] },
  { id: 'schedule',           label: 'Schedule',            hasValue: false, types: ['offsite_conversion.fb_pixel_schedule', 'omni_schedule', 'schedule'] },
  { id: 'find_location',      label: 'Location found',      hasValue: false, types: ['offsite_conversion.fb_pixel_find_location', 'find_location'] },
  { id: 'donate',             label: 'Donate',              hasValue: true,  types: ['offsite_conversion.fb_pixel_donate', 'donate'] },

  // Engagement
  { id: 'landing_page_view',  label: 'Landing page view',   hasValue: false, types: ['landing_page_view'] },
  { id: 'post_engagement',    label: 'Post engagement',     hasValue: false, types: ['post_engagement'] },
  { id: 'page_engagement',    label: 'Page engagement',     hasValue: false, types: ['page_engagement'] },
  { id: 'post_reaction',      label: 'Post reaction',       hasValue: false, types: ['post_reaction'] },
  { id: 'post_save',          label: 'Post save',           hasValue: false, types: ['onsite_conversion.post_save'] },
  { id: 'photo_view',         label: 'Photo view',          hasValue: false, types: ['photo_view'] },
  { id: 'link_click_action',  label: 'Link click (actions)', hasValue: false, types: ['link_click'] },

  // Messaging
  { id: 'messaging_conversation_started', label: 'Messaging conversation started', hasValue: false, types: ['onsite_conversion.messaging_conversation_started_7d'] },
  { id: 'messaging_connection',           label: 'Messaging connections',          hasValue: false, types: ['onsite_conversion.total_messaging_connection'] },

  // App
  { id: 'app_install',        label: 'App install',         hasValue: false, types: ['mobile_app_install', 'app_install', 'omni_app_install'] },
  { id: 'app_activation',     label: 'App activation',      hasValue: false, types: ['omni_activate_app', 'app_custom_event.fb_mobile_activate_app'] },

  // Video events (counted out of the `actions` array, not the dedicated
  // video_*_watched_actions fields — those are covered below).
  { id: 'video_view_action',  label: 'Video views (3 sec)', hasValue: false, types: ['video_view'] },
];

// ── Video action-array metrics (separate top-level fields in the API) ─────
// These live in their own arrays (video_p25_watched_actions etc.) rather
// than inside `actions`. Each returns an array that typically has one entry
// whose `value` is the count we want.
var VIDEO_ACTION_METRICS = [
  { id: 'video_plays',            label: 'Video plays',                         from: 'video_play_actions',                    desc: 'Total number of times your video played. API: video_play_actions.' },
  { id: 'video_p25_watches',      label: 'Video plays at 25%',                  from: 'video_p25_watched_actions',             desc: 'API: video_p25_watched_actions.' },
  { id: 'video_p50_watches',      label: 'Video plays at 50%',                  from: 'video_p50_watched_actions',             desc: 'API: video_p50_watched_actions.' },
  { id: 'video_p75_watches',      label: 'Video plays at 75%',                  from: 'video_p75_watched_actions',             desc: 'API: video_p75_watched_actions.' },
  { id: 'video_p95_watches',      label: 'Video plays at 95%',                  from: 'video_p95_watched_actions',             desc: 'API: video_p95_watched_actions.' },
  { id: 'video_p100_watches',     label: 'Video plays at 100%',                 from: 'video_p100_watched_actions',            desc: 'API: video_p100_watched_actions.' },
  { id: 'video_thruplay_watches', label: 'ThruPlays',                           from: 'video_thruplay_watched_actions',        desc: '15s+ or full length. API: video_thruplay_watched_actions.' },
  { id: 'video_15_sec_watches',   label: 'Video plays at 15 seconds',           from: 'video_15_sec_watched_actions',          desc: 'API: video_15_sec_watched_actions.' },
  { id: 'video_30_sec_watches',   label: 'Video plays at 30 seconds',           from: 'video_30_sec_watched_actions',          desc: 'API: video_30_sec_watched_actions.' },
  { id: 'video_continuous_2_sec_watches', label: 'Video plays (continuous 2s)', from: 'video_continuous_2_sec_watched_actions', desc: 'API: video_continuous_2_sec_watched_actions.' },
  { id: 'video_avg_time_watched', label: 'Video average play time (seconds)',   from: 'video_avg_time_watched_actions',        desc: 'API: video_avg_time_watched_actions.', agg: 'AVG' },
];

// ── ROAS metrics returned as action-typed arrays ──────────────────────────
var ROAS_METRICS = [
  { id: 'purchase_roas',            label: 'Purchase ROAS',            from: 'purchase_roas',            types: ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'] },
  { id: 'website_purchase_roas',    label: 'Website purchase ROAS',    from: 'website_purchase_roas',    types: ['offsite_conversion.fb_pixel_purchase', 'purchase'] },
  { id: 'mobile_app_purchase_roas', label: 'Mobile app purchase ROAS', from: 'mobile_app_purchase_roas', types: ['app_custom_event.fb_mobile_purchase', 'mobile_app_purchase'] },
];

// ─────────────────────────────────────────────────────────────────────────
// Field builder — turns the definitions above into a Looker Studio schema.
// ─────────────────────────────────────────────────────────────────────────

function getSchema(request) {
  return { schema: getFields().build() };
}

function getFields() {
  var cc = CC();
  var fields = cc.getFields();
  var T = cc.FieldType;
  var A = cc.AggregationType;

  DIMENSIONS.forEach(function (d) {
    var f = fields.newDimension().setId(d.id).setName(d.name).setType(T[d.type]);
    if (d.desc) f.setDescription(d.desc);
  });

  SCALAR_METRICS.forEach(function (m) {
    var isQualityRank = m.agg === null;
    var f = isQualityRank
      ? fields.newDimension().setId(m.id).setName(m.name).setType(T.TEXT)
      : fields.newMetric().setId(m.id).setName(m.name).setType(T[m.type]).setAggregation(A[m.agg]);
    if (m.desc) f.setDescription(m.desc);
  });

  // For each conversion event: count + (optional) value + cost-per
  CONVERSION_EVENTS.forEach(function (e) {
    fields.newMetric()
      .setId(e.id)
      .setName(e.label)
      .setType(T.NUMBER)
      .setAggregation(A.SUM)
      .setDescription('Count of ' + e.label.toLowerCase() + ' events. API: actions; action_type matches one of: ' + e.types.join(', ') + '.');

    if (e.hasValue) {
      fields.newMetric()
        .setId(e.id + '_value')
        .setName(e.label + ' conversion value (AUD)')
        .setType(T.CURRENCY_AUD)
        .setAggregation(A.SUM)
        .setDescription('Total monetary value of ' + e.label.toLowerCase() + ' events. API: action_values.');
    }

    fields.newMetric()
      .setId('cost_per_' + e.id)
      .setName('Cost per ' + e.label.toLowerCase() + ' (AUD)')
      .setType(T.CURRENCY_AUD)
      .setAggregation(A.AVG)
      .setDescription('Avg cost per ' + e.label.toLowerCase() + '. API: cost_per_action_type.');
  });

  VIDEO_ACTION_METRICS.forEach(function (v) {
    var agg = v.agg ? A[v.agg] : A.SUM;
    fields.newMetric()
      .setId(v.id)
      .setName(v.label)
      .setType(T.NUMBER)
      .setAggregation(agg)
      .setDescription(v.desc || '');
  });

  ROAS_METRICS.forEach(function (r) {
    fields.newMetric()
      .setId(r.id)
      .setName(r.label)
      .setType(T.NUMBER)
      .setAggregation(A.AVG)
      .setDescription('Return on ad spend. API: ' + r.from + '.');
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
    map[e.id]              = { from: 'actions',              types: e.types };
    map['cost_per_' + e.id] = { from: 'cost_per_action_type', types: e.types };
    if (e.hasValue) {
      map[e.id + '_value'] = { from: 'action_values',         types: e.types };
    }
  });
  ROAS_METRICS.forEach(function (r) {
    map[r.id] = { from: r.from, types: r.types };
  });
  return map;
})();

// Fields whose raw value is an array with one entry per action_type, but
// where we want the SUM of all entries (not a type-specific pick). Used for
// the `video_*_watched_actions` family.
var VIDEO_SUM_FIELDS = (function () {
  var map = {};
  VIDEO_ACTION_METRICS.forEach(function (v) { map[v.id] = v.from; });
  return map;
})();

// Looker Studio's PERCENT field expects a fraction (0.05 = 5%). Meta returns
// percentages as whole numbers (5.0 = 5%). These ids need ÷ 100 at format
// time.
var PERCENT_FIELD_IDS = [
  'ctr', 'unique_ctr',
  'inline_link_click_ctr', 'unique_inline_link_click_ctr',
  'outbound_clicks_ctr', 'unique_outbound_clicks_ctr',
];
