// Schema.gs
//
// Unified field catalog for the AgencyViz GoHighLevel connector. All rows
// (opportunities, contacts, invoices, estimates) share a single schema.
// A "Record Type" dimension distinguishes them. Fields that only apply to
// one type are empty on other types' rows.
//
// Custom fields are fetched dynamically from the GHL API and appended
// under a "Custom Fields" group.

var CC = function () { return DataStudioApp.createCommunityConnector(); };

// ── Unified Dimensions ─────────────────────────────────────────────────

var DIMENSIONS = [
  { id: 'date_added',       name: 'Date Added',        type: 'YEAR_MONTH_DAY', group: 'Date & Time', desc: 'Date the record was created.' },

  // Date rollups — derived client-side from date_added
  { id: 'year',             name: 'Year',               type: 'YEAR',           group: 'Date & Time' },
  { id: 'year_quarter',     name: 'Year-Quarter',       type: 'YEAR_QUARTER',   group: 'Date & Time' },
  { id: 'year_month',       name: 'Year-Month',         type: 'YEAR_MONTH',     group: 'Date & Time' },
  { id: 'year_week',        name: 'Year-Week (ISO)',    type: 'YEAR_WEEK',      group: 'Date & Time' },
  { id: 'quarter',          name: 'Quarter',            type: 'QUARTER',        group: 'Date & Time' },
  { id: 'month',            name: 'Month',              type: 'MONTH',          group: 'Date & Time' },
  { id: 'week',             name: 'Week (ISO)',         type: 'WEEK',           group: 'Date & Time' },
  { id: 'day',              name: 'Day of Month',       type: 'DAY',            group: 'Date & Time' },
  { id: 'day_of_week',      name: 'Day of Week',        type: 'DAY_OF_WEEK',    group: 'Date & Time' },
  { id: 'date_updated',     name: 'Date Updated',       type: 'YEAR_MONTH_DAY', group: 'Date & Time' },

  { id: 'record_type',      name: 'Record Type',        type: 'TEXT',  group: 'Record',       desc: 'opportunity, contact, invoice, or estimate.' },
  { id: 'record_id',        name: 'Record ID',          type: 'TEXT',  group: 'Record' },
  { id: 'record_name',      name: 'Record Name',        type: 'TEXT',  group: 'Record',       desc: 'Opportunity name or contact full name.' },

  // Opportunity-specific
  { id: 'pipeline_name',    name: 'Pipeline',           type: 'TEXT',  group: 'Opportunity',  desc: 'GHL pipeline name (opportunities only).' },
  { id: 'stage_name',       name: 'Stage',              type: 'TEXT',  group: 'Opportunity',  desc: 'Current pipeline stage name.' },
  { id: 'status',           name: 'Status',             type: 'TEXT',  group: 'Opportunity',  desc: 'open, won, lost, or abandoned.' },
  { id: 'source',           name: 'Source',             type: 'TEXT',  group: 'Record',       desc: 'Lead/opportunity source.' },
  { id: 'assigned_to',      name: 'Assigned To',        type: 'TEXT',  group: 'Opportunity',  desc: 'User assigned to the opportunity.' },

  // Contact fields
  { id: 'contact_name',     name: 'Contact Name',       type: 'TEXT',  group: 'Contact' },
  { id: 'contact_email',    name: 'Contact Email',      type: 'TEXT',  group: 'Contact' },
  { id: 'contact_phone',    name: 'Contact Phone',      type: 'TEXT',  group: 'Contact' },
  { id: 'tags',             name: 'Tags',               type: 'TEXT',  group: 'Contact',      desc: 'Comma-separated tags.' },

  { id: 'location_id',      name: 'Location ID',        type: 'TEXT',  group: 'Location' },

  // Invoice-specific
  { id: 'invoice_number',   name: 'Invoice Number',     type: 'TEXT',  group: 'Invoice',      desc: 'Full invoice number (prefix + number).' },
  { id: 'issue_date',       name: 'Issue Date',         type: 'YEAR_MONTH_DAY', group: 'Invoice' },
  { id: 'due_date',         name: 'Due Date',           type: 'YEAR_MONTH_DAY', group: 'Invoice' },
  { id: 'currency',         name: 'Currency',           type: 'TEXT',  group: 'Invoice' },
  { id: 'company_name',     name: 'Company Name',       type: 'TEXT',  group: 'Contact',      desc: 'Contact company name (invoices/estimates).' },

  // Estimate-specific
  { id: 'estimate_number',  name: 'Estimate Number',    type: 'TEXT',  group: 'Estimate',     desc: 'Full estimate number (prefix + number).' },
  { id: 'expiry_date',      name: 'Expiry Date',        type: 'YEAR_MONTH_DAY', group: 'Estimate' },
];

// ── Unified Metrics ────────────────────────────────────────────────────

var METRICS = [
  { id: 'monetary_value',   name: 'Monetary Value',     type: 'NUMBER', semantic: 'CURRENCY_AUD', group: 'Opportunity', desc: 'Deal value in currency.' },
  { id: 'opp_count',        name: 'Opportunity Count',  type: 'NUMBER', group: 'Opportunity', desc: '1 per opportunity row, 0 for contacts.' },
  { id: 'won_count',        name: 'Won Count',          type: 'NUMBER', group: 'Opportunity', desc: '1 if status=won, else 0.' },
  { id: 'lost_count',       name: 'Lost Count',         type: 'NUMBER', group: 'Opportunity', desc: '1 if status=lost, else 0.' },
  { id: 'contact_count',    name: 'Contact Count',      type: 'NUMBER', group: 'Contact',     desc: '1 per contact row, 0 for others.' },

  // Invoice metrics
  { id: 'invoice_total',    name: 'Invoice Total',      type: 'NUMBER', semantic: 'CURRENCY_AUD', group: 'Invoice', desc: 'Total invoice amount.' },
  { id: 'amount_paid',      name: 'Amount Paid',        type: 'NUMBER', semantic: 'CURRENCY_AUD', group: 'Invoice', desc: 'Amount paid on invoice.' },
  { id: 'amount_due',       name: 'Amount Due',         type: 'NUMBER', semantic: 'CURRENCY_AUD', group: 'Invoice', desc: 'Remaining amount due.' },
  { id: 'invoice_count',    name: 'Invoice Count',      type: 'NUMBER', group: 'Invoice',     desc: '1 per invoice row.' },
  { id: 'paid_invoice_count', name: 'Paid Invoice Count', type: 'NUMBER', group: 'Invoice',   desc: '1 if invoice status=paid.' },
  { id: 'line_item_count',  name: 'Line Item Count',    type: 'NUMBER', group: 'Invoice',     desc: 'Number of line items.' },

  // Estimate metrics
  { id: 'estimate_total',   name: 'Estimate Total',     type: 'NUMBER', semantic: 'CURRENCY_AUD', group: 'Estimate', desc: 'Total estimate amount.' },
  { id: 'estimate_count',   name: 'Estimate Count',     type: 'NUMBER', group: 'Estimate',   desc: '1 per estimate row.' },
  { id: 'accepted_estimate_count', name: 'Accepted Estimate Count', type: 'NUMBER', group: 'Estimate', desc: '1 if estimate status=accepted.' },
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

function fetchCustomFieldDefs(locationId) {
  if (_customFieldCache[locationId]) return _customFieldCache[locationId];

  var allDefs = [];

  // Fetch both opportunity and contact custom fields
  ['opportunity', 'contact'].forEach(function (model) {
    try {
      var resp = callApi(
        '/api/connectors/ghl/custom-fields?location_id=' + encodeURIComponent(locationId)
        + '&model=' + model,
        'GET',
        null,
      );
      var defs = (resp && resp.data && resp.data.custom_fields) || [];
      defs.forEach(function (cf) { cf._model = model; });
      allDefs = allDefs.concat(defs);
    } catch (e) {
      // Non-fatal
    }
  });

  // Deduplicate by ID (same custom field can appear in both models)
  var seen = {};
  var deduped = [];
  allDefs.forEach(function (cf) {
    if (!seen[cf.id]) {
      seen[cf.id] = true;
      deduped.push(cf);
    }
  });

  _customFieldCache[locationId] = deduped;
  return deduped;
}

// ── Field builder ───────────────────────────────────────────────────────

function getFields(locationId) {
  var cc = CC();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var agg = cc.AggregationType;

  DIMENSIONS.forEach(function (d) {
    var f = fields.newDimension()
      .setId(d.id)
      .setName(d.name)
      .setType(types[d.type]);
    if (d.group) f.setGroup(d.group);
    if (d.desc) f.setDescription(d.desc);
  });

  METRICS.forEach(function (m) {
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
    var customDefs = fetchCustomFieldDefs(locationId);
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
  var locationId = request.configParams && request.configParams.location_id;
  return { schema: getFields(locationId).build() };
}
