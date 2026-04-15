// Schema.gs
//
// Field catalog returned by getSchema(). Naming + descriptions are aligned
// with Meta's Ads Manager UI (https://www.facebook.com/business/help/) so
// numbers match what users see in Ads Manager by default.
//
// Currency is fixed at AUD — change to match your account currency if
// needed. Looker Studio's schema is static (one currency per connector),
// so if you mix currencies across accounts you'll need separate deployments.

var CC = function() { return DataStudioApp.createCommunityConnector(); };
var CURRENCY = function() { return CC().FieldType.CURRENCY_AUD; };

function getSchema(request) {
  return { schema: getFields().build() };
}

function getFields() {
  var cc = CC();
  var fields = cc.getFields();
  var T = cc.FieldType;
  var A = cc.AggregationType;

  // ── Dimensions ──────────────────────────────────────────────────────────
  fields.newDimension().setId('date_start').setName('Date').setType(T.YEAR_MONTH_DAY)
    .setDescription('Reporting date (day grain). Corresponds to Meta\'s date_start.');

  fields.newDimension().setId('account_id').setName('Account ID').setType(T.TEXT);
  fields.newDimension().setId('account_name').setName('Account name').setType(T.TEXT);

  fields.newDimension().setId('campaign_id').setName('Campaign ID').setType(T.TEXT);
  fields.newDimension().setId('campaign_name').setName('Campaign name').setType(T.TEXT);
  fields.newDimension().setId('objective').setName('Campaign objective').setType(T.TEXT)
    .setDescription('e.g. OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC.');
  fields.newDimension().setId('buying_type').setName('Buying type').setType(T.TEXT)
    .setDescription('AUCTION or RESERVED.');

  fields.newDimension().setId('adset_id').setName('Ad set ID').setType(T.TEXT);
  fields.newDimension().setId('adset_name').setName('Ad set name').setType(T.TEXT);

  fields.newDimension().setId('ad_id').setName('Ad ID').setType(T.TEXT);
  fields.newDimension().setId('ad_name').setName('Ad name').setType(T.TEXT);

  // ── Core delivery metrics ───────────────────────────────────────────────
  fields.newMetric().setId('impressions').setName('Impressions').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Number of times your ads were on screen.');

  fields.newMetric().setId('reach').setName('Reach').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Number of people who saw your ads at least once. Aggregated across the grain you pick — not always unique across days.');

  fields.newMetric().setId('frequency').setName('Frequency').setType(T.NUMBER).setAggregation(A.AVG)
    .setDescription('Average number of times each person saw your ad.');

  fields.newMetric().setId('spend').setName('Amount spent (AUD)').setType(CURRENCY()).setAggregation(A.SUM)
    .setDescription('Total amount spent on your ads during the period.');

  // ── Clicks + CPC ────────────────────────────────────────────────────────
  fields.newMetric().setId('clicks').setName('Clicks (all)').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Every click on your ad, including engagement clicks. Usually higher than link clicks.');

  fields.newMetric().setId('cpc').setName('CPC (all) (AUD)').setType(CURRENCY()).setAggregation(A.AVG)
    .setDescription('Average cost for each click (all). = Spend ÷ Clicks (all).');

  fields.newMetric().setId('cpm').setName('CPM (cost per 1,000 impressions) (AUD)').setType(CURRENCY()).setAggregation(A.AVG)
    .setDescription('Average cost per 1,000 impressions. = (Spend ÷ Impressions) × 1,000.');

  fields.newMetric().setId('ctr').setName('CTR (all)').setType(T.PERCENT).setAggregation(A.AVG)
    .setDescription('Click-through rate on all clicks. = Clicks (all) ÷ Impressions.');

  fields.newMetric().setId('inline_link_clicks').setName('Link clicks').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Clicks on ad links leading to destinations off Facebook/Instagram.');

  fields.newMetric().setId('cost_per_inline_link_click').setName('CPC (cost per link click) (AUD)').setType(CURRENCY()).setAggregation(A.AVG)
    .setDescription('Average cost per link click. = Spend ÷ Link clicks.');

  fields.newMetric().setId('inline_link_click_ctr').setName('CTR (link click-through rate)').setType(T.PERCENT).setAggregation(A.AVG)
    .setDescription('Link click-through rate. = Link clicks ÷ Impressions.');

  fields.newMetric().setId('unique_inline_link_clicks').setName('Unique link clicks').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Number of people who clicked an ad link. Deduplicated within the reporting window.');

  // ── Action-based metrics (synthetic — derived from Meta\'s `actions` array) ─
  fields.newMetric().setId('purchases').setName('Website purchases').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Purchases tracked by your Meta pixel / conversions API.');

  fields.newMetric().setId('purchase_value').setName('Purchases conversion value (AUD)').setType(CURRENCY()).setAggregation(A.SUM)
    .setDescription('Total value of purchases tracked via your Meta pixel. Basis for Purchase ROAS.');

  fields.newMetric().setId('purchase_roas').setName('Purchase ROAS').setType(T.NUMBER).setAggregation(A.AVG)
    .setDescription('Return on ad spend from website purchases. = Purchase value ÷ Amount spent.');

  fields.newMetric().setId('leads').setName('Leads').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Lead events tracked by your Meta pixel / instant-form leads.');

  fields.newMetric().setId('add_to_cart').setName('Adds to cart').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Adds-to-cart events tracked by your Meta pixel.');

  fields.newMetric().setId('initiate_checkout').setName('Checkouts initiated').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Initiate-checkout events tracked by your Meta pixel.');

  fields.newMetric().setId('landing_page_views').setName('Landing page views').setType(T.NUMBER).setAggregation(A.SUM)
    .setDescription('Number of times people loaded the landing page after clicking your ad.');

  return fields;
}

// Declarative mapping of synthetic-metric id → which Meta action_type(s) to
// look up. First match wins when multiple types are listed (Meta fires
// several variants for the same user event depending on source).
var ACTION_FIELD_MAP = {
  purchases:          { from: 'actions',       types: ['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase'] },
  purchase_value:     { from: 'action_values', types: ['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase'] },
  leads:              { from: 'actions',       types: ['offsite_conversion.fb_pixel_lead', 'lead', 'onsite_conversion.lead_grouped'] },
  add_to_cart:        { from: 'actions',       types: ['offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart', 'add_to_cart'] },
  initiate_checkout:  { from: 'actions',       types: ['offsite_conversion.fb_pixel_initiate_checkout', 'omni_initiated_checkout', 'initiate_checkout'] },
  landing_page_views: { from: 'actions',       types: ['landing_page_view'] },
};

// Looker Studio PERCENT fields expect a fraction (0.05 = 5%). Meta returns
// percentages as whole numbers (5.0 = 5%). These ids need divide-by-100.
var PERCENT_FIELD_IDS = ['ctr', 'inline_link_click_ctr'];
