// Schema.gs
//
// Field catalog for the AgencyViz GoHighLevel connector. Two data types:
// Opportunities (pipeline deals) and Contacts (leads).
//
// Custom fields are fetched dynamically from the GHL API based on the
// selected location, and appended to the schema under a "Custom Fields"
// group. The schema is rebuilt each time getSchema() is called.

var CC = function () { return DataStudioApp.createCommunityConnector(); };

// ── Opportunity Dimensions ──────────────────────────────────────────────

var OPP_DIMENSIONS = [
  { id: 'date_added',       name: 'Date Added',        type: 'YEAR_MONTH_DAY', group: 'Date & Time', desc: 'Date the opportunity was created.' },

  // Date rollups — derived client-side from date_added
  { id: 'year',             name: 'Year',               type: 'YEAR',           group: 'Date & Time', desc: 'Year (YYYY). Derived from Date Added.' },
  { id: 'year_quarter',     name: 'Year-Quarter',       type: 'YEAR_QUARTER',   group: 'Date & Time', desc: 'Year + quarter (YYYYQ). Derived from Date Added.' },
  { id: 'year_month',       name: 'Year-Month',         type: 'YEAR_MONTH',     group: 'Date & Time', desc: 'Year + month (YYYYMM). Derived from Date Added.' },
  { id: 'year_week',        name: 'Year-Week (ISO)',    type: 'YEAR_WEEK',      group: 'Date & Time', desc: 'Year + ISO week (YYYYWW). Derived from Date Added.' },
  { id: 'quarter',          name: 'Quarter',            type: 'QUARTER',        group: 'Date & Time', desc: 'Quarter (1-4). Derived from Date Added.' },
  { id: 'month',            name: 'Month',              type: 'MONTH',          group: 'Date & Time', desc: 'Month number (01-12). Derived from Date Added.' },
  { id: 'week',             name: 'Week (ISO)',         type: 'WEEK',           group: 'Date & Time', desc: 'ISO week number (01-53). Derived from Date Added.' },
  { id: 'day',              name: 'Day of Month',       type: 'DAY',            group: 'Date & Time', desc: 'Day of month (01-31). Derived from Date Added.' },
  { id: 'day_of_week',      name: 'Day of Week',        type: 'DAY_OF_WEEK',    group: 'Date & Time', desc: 'Day of week (0=Sunday … 6=Saturday).' },

  { id: 'opp_id',           name: 'Opportunity ID',     type: 'TEXT',  group: 'Opportunity' },
  { id: 'opp_name',         name: 'Opportunity Name',   type: 'TEXT',  group: 'Opportunity' },
  { id: 'pipeline_name',    name: 'Pipeline',           type: 'TEXT',  group: 'Opportunity', desc: 'Name of the GHL pipeline.' },
  { id: 'stage_name',       name: 'Stage',              type: 'TEXT',  group: 'Opportunity', desc: 'Current pipeline stage name.' },
  { id: 'status',           name: 'Status',             type: 'TEXT',  group: 'Opportunity', desc: 'open, won, lost, or abandoned.' },
  { id: 'source',           name: 'Source',             type: 'TEXT',  group: 'Opportunity', desc: 'Lead/opportunity source.' },
  { id: 'assigned_to',      name: 'Assigned To',        type: 'TEXT',  group: 'Opportunity', desc: 'User assigned to the opportunity.' },
  { id: 'contact_name',     name: 'Contact Name',       type: 'TEXT',  group: 'Contact',     desc: 'Primary contact name.' },
  { id: 'contact_email',    name: 'Contact Email',      type: 'TEXT',  group: 'Contact' },
  { id: 'date_updated',     name: 'Date Updated',       type: 'YEAR_MONTH_DAY', group: 'Date & Time' },
  { id: 'location_id',      name: 'Location ID',        type: 'TEXT',  group: 'Location' },
];

// ── Opportunity Metrics ─────────────────────────────────────────────────

var OPP_METRICS = [
  { id: 'monetary_value',   name: 'Monetary Value',     type: 'NUMBER', semantic: 'CURRENCY_AUD', group: 'Opportunity', desc: 'Deal value in currency.' },
  { id: 'opp_count',        name: 'Opportunity Count',  type: 'NUMBER', group: 'Opportunity', desc: 'Count of opportunities (1 per row).' },
  { id: 'won_count',        name: 'Won Count',          type: 'NUMBER', group: 'Opportunity', desc: '1 if status=won, else 0.' },
  { id: 'lost_count',       name: 'Lost Count',         type: 'NUMBER', group: 'Opportunity', desc: '1 if status=lost, else 0.' },
];

// ── Contact Dimensions ──────────────────────────────────────────────────

var CONTACT_DIMENSIONS = [
  { id: 'date_added',       name: 'Date Added',         type: 'YEAR_MONTH_DAY', group: 'Date & Time' },

  { id: 'year',             name: 'Year',               type: 'YEAR',           group: 'Date & Time' },
  { id: 'year_quarter',     name: 'Year-Quarter',       type: 'YEAR_QUARTER',   group: 'Date & Time' },
  { id: 'year_month',       name: 'Year-Month',         type: 'YEAR_MONTH',     group: 'Date & Time' },
  { id: 'year_week',        name: 'Year-Week (ISO)',    type: 'YEAR_WEEK',      group: 'Date & Time' },
  { id: 'quarter',          name: 'Quarter',            type: 'QUARTER',        group: 'Date & Time' },
  { id: 'month',            name: 'Month',              type: 'MONTH',          group: 'Date & Time' },
  { id: 'week',             name: 'Week (ISO)',         type: 'WEEK',           group: 'Date & Time' },
  { id: 'day',              name: 'Day of Month',       type: 'DAY',            group: 'Date & Time' },
  { id: 'day_of_week',      name: 'Day of Week',        type: 'DAY_OF_WEEK',    group: 'Date & Time' },

  { id: 'contact_id',       name: 'Contact ID',         type: 'TEXT',  group: 'Contact' },
  { id: 'contact_name',     name: 'Name',               type: 'TEXT',  group: 'Contact' },
  { id: 'contact_email',    name: 'Email',              type: 'TEXT',  group: 'Contact' },
  { id: 'contact_phone',    name: 'Phone',              type: 'TEXT',  group: 'Contact' },
  { id: 'tags',             name: 'Tags',               type: 'TEXT',  group: 'Contact', desc: 'Comma-separated tags.' },
  { id: 'source',           name: 'Source',             type: 'TEXT',  group: 'Contact' },
  { id: 'date_updated',     name: 'Date Updated',       type: 'YEAR_MONTH_DAY', group: 'Date & Time' },
  { id: 'location_id',      name: 'Location ID',        type: 'TEXT',  group: 'Location' },
];

// ── Contact Metrics ─────────────────────────────────────────────────────

var CONTACT_METRICS = [
  { id: 'contact_count',    name: 'Contact Count',      type: 'NUMBER', group: 'Contact', desc: 'Count of contacts (1 per row).' },
];

// ── Date rollup lookup ──────────────────────────────────────────────────

var DATE_ROLLUP_FIELD_IDS = {
  year: true, year_quarter: true, year_month: true, year_week: true,
  quarter: true, month: true, week: true, day: true, day_of_week: true,
};

// ── GHL data type → Looker Studio field type mapping ────────────────────

var GHL_TYPE_MAP = {
  TEXT:          'TEXT',
  LARGE_TEXT:    'TEXT',
  TEXTAREA:     'TEXT',
  TEXTBOX_LIST: 'TEXT',
  PHONE:        'TEXT',
  EMAIL:        'TEXT',
  URL:          'URL',
  NUMERICAL:    'NUMBER',
  NUMBER:       'NUMBER',
  MONETORY:     'NUMBER',
  MONETARY:     'NUMBER',
  FLOAT:        'NUMBER',
  DATE:         'YEAR_MONTH_DAY',
  CHECKBOX:     'TEXT',
  SINGLE_OPTIONS: 'TEXT',
  MULTIPLE_OPTIONS: 'TEXT',
  RADIO:        'TEXT',
  FILE_UPLOAD:  'TEXT',
  SIGNATURE:    'TEXT',
};

// ── Custom field cache (per-execution, avoids duplicate API calls) ──────

var _customFieldCache = {};

function fetchCustomFieldDefs(locationId, dataType) {
  var cacheKey = locationId + ':' + dataType;
  if (_customFieldCache[cacheKey]) return _customFieldCache[cacheKey];

  var model = dataType === 'contacts' ? 'contact' : 'opportunity';
  try {
    var resp = callApi(
      '/api/connectors/ghl/custom-fields?location_id=' + encodeURIComponent(locationId)
      + '&model=' + model,
      'GET',
      null,
    );
    var defs = (resp && resp.data && resp.data.custom_fields) || [];
    _customFieldCache[cacheKey] = defs;
    return defs;
  } catch (e) {
    // Non-fatal — schema will just omit custom fields
    return [];
  }
}

// ── Field builder ───────────────────────────────────────────────────────

function getFields(dataType, locationId) {
  var cc = CC();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var agg = cc.AggregationType;

  var dims = dataType === 'contacts' ? CONTACT_DIMENSIONS : OPP_DIMENSIONS;
  var metrics = dataType === 'contacts' ? CONTACT_METRICS : OPP_METRICS;

  dims.forEach(function (d) {
    var f = fields.newDimension()
      .setId(d.id)
      .setName(d.name)
      .setType(types[d.type]);
    if (d.group) f.setGroup(d.group);
    if (d.desc) f.setDescription(d.desc);
  });

  metrics.forEach(function (m) {
    var f = fields.newMetric()
      .setId(m.id)
      .setName(m.name)
      .setType(types[m.type])
      .setAggregation(agg.SUM);
    if (m.group) f.setGroup(m.group);
    if (m.desc) f.setDescription(m.desc);
  });

  // Dynamic custom fields from GHL
  if (locationId) {
    var customDefs = fetchCustomFieldDefs(locationId, dataType);
    customDefs.forEach(function (cf) {
      var lookerType = GHL_TYPE_MAP[cf.dataType] || 'TEXT';
      var isNumeric = lookerType === 'NUMBER';

      if (isNumeric) {
        var mf = fields.newMetric()
          .setId('cf_' + cf.id)
          .setName(cf.name)
          .setType(types[lookerType])
          .setAggregation(agg.SUM)
          .setGroup('Custom Fields');
        if (cf.dataType === 'MONETORY' || cf.dataType === 'MONETARY') {
          mf.setDescription('Custom field (currency)');
        }
      } else {
        fields.newDimension()
          .setId('cf_' + cf.id)
          .setName(cf.name)
          .setType(types[lookerType])
          .setGroup('Custom Fields');
      }
    });
  }

  return fields;
}

function getSchema(request) {
  var dataType = (request.configParams && request.configParams.data_type) || 'opportunities';
  var locationId = request.configParams && request.configParams.location_id;
  return { schema: getFields(dataType, locationId).build() };
}
