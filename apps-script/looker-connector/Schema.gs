// Schema.gs
//
// Field catalog returned by getSchema(). Field names match the keys Meta's
// /insights endpoint returns, which is what /api/connectors/meta/data passes
// through. When adding a field here, also add it to
// lib/connectors/meta/fields.ts → ALLOWED_INSIGHT_FIELDS in the main repo.

var CC = function() { return DataStudioApp.createCommunityConnector(); };

function getSchema(request) {
  return { schema: getFields().build() };
}

function getFields() {
  var cc = CC();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var agg = cc.AggregationType;

  // Dimensions
  fields.newDimension().setId('date_start').setName('Date').setType(types.YEAR_MONTH_DAY);
  fields.newDimension().setId('campaign_id').setName('Campaign ID').setType(types.TEXT);
  fields.newDimension().setId('campaign_name').setName('Campaign').setType(types.TEXT);
  fields.newDimension().setId('adset_id').setName('Ad Set ID').setType(types.TEXT);
  fields.newDimension().setId('adset_name').setName('Ad Set').setType(types.TEXT);
  fields.newDimension().setId('ad_id').setName('Ad ID').setType(types.TEXT);
  fields.newDimension().setId('ad_name').setName('Ad').setType(types.TEXT);
  fields.newDimension().setId('account_id').setName('Account ID').setType(types.TEXT);
  fields.newDimension().setId('account_name').setName('Account').setType(types.TEXT);

  // Metrics
  fields.newMetric().setId('impressions').setName('Impressions').setType(types.NUMBER).setAggregation(agg.SUM);
  fields.newMetric().setId('clicks').setName('Clicks').setType(types.NUMBER).setAggregation(agg.SUM);
  fields.newMetric().setId('spend').setName('Spend').setType(types.CURRENCY_USD).setAggregation(agg.SUM);
  fields.newMetric().setId('reach').setName('Reach').setType(types.NUMBER).setAggregation(agg.SUM);
  fields.newMetric().setId('frequency').setName('Frequency').setType(types.NUMBER).setAggregation(agg.AVG);
  fields.newMetric().setId('cpm').setName('CPM').setType(types.CURRENCY_USD).setAggregation(agg.AVG);
  fields.newMetric().setId('cpc').setName('CPC').setType(types.CURRENCY_USD).setAggregation(agg.AVG);
  fields.newMetric().setId('ctr').setName('CTR').setType(types.PERCENT).setAggregation(agg.AVG);
  fields.newMetric().setId('inline_link_clicks').setName('Link Clicks').setType(types.NUMBER).setAggregation(agg.SUM);
  fields.newMetric().setId('inline_link_click_ctr').setName('Link CTR').setType(types.PERCENT).setAggregation(agg.AVG);

  return fields;
}
