// Code.gs
//
// Entry point for the AgencyViz GoHighLevel community connector. Looker
// Studio lifecycle:
//   1. getAuthType()  — OAuth.gs
//   2. getConfig()    — location + data type picker
//   3. getSchema()    — Schema.gs (driven by data_type)
//   4. getData()      — this file; fetches from GHL via AgencyViz API

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  config.newInfo().setId('intro').setText(
    'Choose a GoHighLevel location (sub-account). Connect your GHL agency '
    + 'token at app.agencyviz.io → Integrations → Looker Studio first.'
  );

  // Location selector — populated from the AgencyViz API
  var locationSelector = config
    .newSelectSingle()
    .setId('location_id')
    .setName('Location (Sub-Account)')
    .setHelpText('Choose which GHL location to pull data from.');

  try {
    var resp = callApi('/api/connectors/ghl/locations', 'GET', null);
    var locations = (resp && resp.data && resp.data.locations) || [];
    locations.forEach(function (loc) {
      locationSelector.addOption(
        config.newOptionBuilder()
          .setLabel(loc.name || loc.id)
          .setValue(loc.id),
      );
    });
    if (locations.length === 0) {
      config.newInfo().setId('no_locations').setText(
        'No locations found. Make sure your GHL agency token is connected '
        + 'at app.agencyviz.io → Integrations → Looker Studio.',
      );
    }
  } catch (e) {
    config.newInfo().setId('err').setText('Could not load locations: ' + e.message);
  }

  config.setDateRangeRequired(true);
  return config.build();
}

function getData(request) {
  var locationId = request.configParams && request.configParams.location_id;

  if (!locationId) {
    throwUserError('Please pick a GHL location in the connector configuration.');
  }
  if (!request.dateRange || !request.dateRange.startDate || !request.dateRange.endDate) {
    throwUserError('A date range is required for this connector.');
  }

  var requestedFieldIds = (request.fields || []).map(function (f) { return f.name; });
  var allFields = getFields(locationId);
  var scopedFields = allFields.forIds(requestedFieldIds);

  var body = {
    location_id: locationId,
    date_from: request.dateRange.startDate,
    date_to: request.dateRange.endDate,
  };

  var resp;
  try {
    resp = callApi('/api/connectors/ghl/data', 'POST', body);
  } catch (e) {
    throwUserError('Could not fetch data from GoHighLevel: ' + e.message);
  }

  var rawRows = (resp && resp.data && resp.data.rows) || [];
  var rows = rawRows.map(function (row) {
    return {
      values: requestedFieldIds.map(function (id) {
        return formatValue(resolveFieldValue(row, id), id);
      }),
    };
  });

  return { schema: scopedFields.build(), rows: rows };
}

// ── Field Resolution ────────────────────────────────────────────────────

function resolveFieldValue(row, fieldId) {
  // Date rollups
  if (DATE_ROLLUP_FIELD_IDS[fieldId]) {
    var dateStr = row.dateAdded || row.date_added;
    return computeDateRollup(dateStr, fieldId);
  }

  // Custom fields — flattened server-side to cf_<id> keys
  if (fieldId.indexOf('cf_') === 0) {
    var val = row[fieldId];
    return val !== undefined && val !== null ? val : '';
  }

  switch (fieldId) {
    case 'date_added':     return row.dateAdded;
    case 'date_updated':   return row.dateUpdated;
    case 'record_type':    return row.record_type || '';
    case 'record_id':      return row.id;
    case 'record_name':    return row.name || ((row.firstName || '') + ' ' + (row.lastName || '')).trim() || '';
    case 'pipeline_name':  return row.pipelineName || '';
    case 'stage_name':     return row.stageName || '';
    case 'status':         return row.status || '';
    case 'monetary_value': return row.monetaryValue || 0;
    case 'source':         return row.source || '';
    case 'assigned_to':    return row.assignedTo || '';
    case 'contact_name':   return row.contactName || ((row.firstName || '') + ' ' + (row.lastName || '')).trim() || '';
    case 'contact_email':  return row.contactEmail || row.email || '';
    case 'contact_phone':  return row.phone || '';
    case 'tags':           return Array.isArray(row.tags) ? row.tags.join(', ') : '';
    case 'location_id':    return row.locationId || '';
    case 'opp_count':      return row.record_type === 'opportunity' ? 1 : 0;
    case 'won_count':      return row.status === 'won' ? 1 : 0;
    case 'lost_count':     return row.status === 'lost' ? 1 : 0;
    case 'contact_count':  return row.record_type === 'contact' ? 1 : 0;
    default:               return '';
  }
}

// ── Date Rollups ────────────────────────────────────────────────────────

function computeDateRollup(dateStr, fieldId) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  var y = d.getUTCFullYear();
  var m = d.getUTCMonth() + 1;
  var dom = d.getUTCDate();
  var dow = d.getUTCDay();
  var quarter = Math.ceil(m / 3);
  var iso = getIsoWeek(d);
  switch (fieldId) {
    case 'year':           return String(y);
    case 'year_quarter':   return String(y) + 'Q' + quarter;
    case 'year_month':     return String(y) + pad2(m);
    case 'year_week':      return String(iso.year) + pad2(iso.week);
    case 'quarter':        return String(quarter);
    case 'month':          return pad2(m);
    case 'week':           return pad2(iso.week);
    case 'day':            return pad2(dom);
    case 'day_of_week':    return String(dow);
  }
  return '';
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function getIsoWeek(d) {
  var target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  var dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  var firstThursday = target.getTime();
  var jan4 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  var jan4DayNr = (jan4.getUTCDay() + 6) % 7;
  jan4.setUTCDate(jan4.getUTCDate() - jan4DayNr + 3);
  return {
    year: target.getUTCFullYear(),
    week: 1 + Math.round((firstThursday - jan4.getTime()) / 604800000),
  };
}

// ── Formatting ──────────────────────────────────────────────────────────

function formatValue(value, fieldId) {
  if (value === null || value === undefined || value === '') {
    if (isNumericField(fieldId)) return 0;
    return '';
  }
  if (fieldId === 'date_added' || fieldId === 'date_updated') {
    var ds = String(value);
    if (ds.length >= 10) return ds.slice(0, 10).replace(/-/g, '');
    return ds;
  }
  if (DATE_ROLLUP_FIELD_IDS[fieldId]) return String(value);
  var numeric = typeof value === 'number'
    ? value
    : (typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : null);
  if (numeric !== null) return numeric;
  return String(value);
}

var NUMERIC_FIELD_IDS = {
  monetary_value: true, opp_count: true, won_count: true, lost_count: true,
  contact_count: true,
};

function isNumericField(fieldId) {
  return !!NUMERIC_FIELD_IDS[fieldId];
}

// ── API Helpers ─────────────────────────────────────────────────────────

function throwUserError(message) {
  var cc = DataStudioApp.createCommunityConnector();
  cc.newUserError().setText(message).throwException();
}

function callApi(path, method, body) {
  var service = getOAuthService();
  var token = service.getAccessToken();
  if (!token) throwUserError('Not signed in to AgencyViz. Please re-authorize.');

  var options = {
    method: (method || 'GET').toLowerCase(),
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  };
  if (body) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }

  var resp = UrlFetchApp.fetch(API_BASE + path, options);
  var code = resp.getResponseCode();
  var text = resp.getContentText();

  if (code === 401) {
    service.reset();
    throw new Error('Session expired. Reconnect the connector to continue.');
  }
  if (code >= 400) {
    throw new Error('API ' + code + ': ' + text.slice(0, 200));
  }
  return JSON.parse(text);
}

function isAdminUser() {
  return false;
}
