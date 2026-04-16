// Code.gs
//
// Entry point for the AgencyViz Facebook Ads community connector. Looker
// Studio lifecycle:
//   1. getAuthType()  — OAuth.gs
//   2. getConfig()    — ad-account picker
//   3. getSchema()    — Schema.gs
//   4. getData()      — this file; maps schema ids to Meta API fields

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  config.newInfo().setId('intro').setText(
    'Choose which connected Facebook ad account to pull data from. Manage '
    + 'connections at app.agencyviz.io → Ad Tracker → Looker Studio.',
  );

  var selector = config
    .newSelectSingle()
    .setId('ad_account_id')
    .setName('Ad account')
    .setHelpText('Only accounts you have connected in AgencyViz are listed.')
    .setIsDynamic(true);

  try {
    var resp = callApi('/api/connectors/meta/accounts', 'GET', null);
    var accounts = (resp && resp.data && resp.data.accounts) || [];
    accounts.forEach(function (a) {
      selector.addOption(
        config.newOptionBuilder()
          .setLabel((a.account_name || a.ad_account_id)
            + (a.business_name ? ' (' + a.business_name + ')' : ''))
          .setValue(a.ad_account_id),
      );
    });
  } catch (e) {
    config.newInfo().setId('err').setText('Could not load ad accounts: ' + e.message);
  }

  config.setDateRangeRequired(true);
  return config.build();
}

function getData(request) {
  var adAccountId = request.configParams && request.configParams.ad_account_id;
  if (!adAccountId) {
    throwUserError('Please pick an ad account in the connector configuration.');
  }
  if (!request.dateRange || !request.dateRange.startDate || !request.dateRange.endDate) {
    throwUserError('A date range is required for this connector.');
  }

  var requestedFieldIds = (request.fields || []).map(function (f) { return f.name; });
  // Any breakdown dimensions the user dragged into the chart become
  // `breakdowns=` params on the Meta call. Meta splits row grain per
  // breakdown and returns each value under a key matching the breakdown
  // name — resolveFieldValue reads those directly.
  var breakdowns = breakdownsFromFields(requestedFieldIds);
  var allFields = getFields();
  var scopedFields = allFields.forIds(requestedFieldIds);

  // Resolve schema ids → Meta API field names. Dedup so we don't waste a
  // slot on e.g. `actions` when three conversion metrics all need it.
  // Breakdown dimension ids are NOT insights fields — Meta returns them
  // automatically when `breakdowns=` is set, so we skip them here.
  var apiFieldSet = {};
  requestedFieldIds.forEach(function (id) {
    if (BREAKDOWN_DIMENSIONS[id]) return;
    var apiField = schemaIdToApiField(id);
    if (apiField) apiFieldSet[apiField] = true;
  });
  var apiFields = Object.keys(apiFieldSet);

  var body = {
    ad_account_id: adAccountId,
    date_from: request.dateRange.startDate,
    date_to: request.dateRange.endDate,
    fields: apiFields,
    level: 'ad',
  };
  if (breakdowns.length > 0) body.breakdowns = breakdowns;

  var resp;
  try {
    resp = callApi('/api/connectors/meta/data', 'POST', body);
  } catch (e) {
    throwUserError('Could not fetch data from Facebook: ' + e.message);
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

// Map a Looker Studio schema id to the API field we need to request.
function schemaIdToApiField(id) {
  if (ACTION_FIELD_MAP[id])      return ACTION_FIELD_MAP[id].from;
  if (VIDEO_SUM_FIELDS[id])      return VIDEO_SUM_FIELDS[id];
  if (DATE_ROLLUP_FIELD_IDS[id]) return 'date_start';
  return id;
}

// Pull a scalar value out of an API row for a given schema id.
function resolveFieldValue(row, fieldId) {
  if (DATE_ROLLUP_FIELD_IDS[fieldId]) {
    return computeDateRollup(row.date_start, fieldId);
  }

  var actionMap = ACTION_FIELD_MAP[fieldId];
  if (actionMap) {
    var arr = row[actionMap.from];
    if (!Array.isArray(arr)) return 0;
    for (var i = 0; i < actionMap.types.length; i++) {
      var wanted = actionMap.types[i];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j].action_type === wanted) {
          return toNumber(arr[j].value);
        }
      }
    }
    return 0;
  }

  if (VIDEO_SUM_FIELDS[fieldId]) {
    var varr = row[VIDEO_SUM_FIELDS[fieldId]];
    if (!Array.isArray(varr)) return 0;
    var sum = 0;
    for (var k = 0; k < varr.length; k++) sum += toNumber(varr[k].value);
    return sum;
  }

  return row[fieldId];
}

// Compute a date-rollup value from an ISO YYYY-MM-DD string. Looker Studio
// expects specific string formats per FieldType — see the community
// connector docs. Returns '' on malformed input so empty cells don't
// pollute charts.
function computeDateRollup(dateStr, fieldId) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  var y = d.getUTCFullYear();
  var m = d.getUTCMonth() + 1;
  var dow = d.getUTCDay();  // 0=Sun..6=Sat — matches Looker DAY_OF_WEEK convention
  var quarter = Math.ceil(m / 3);
  var iso = getIsoWeek(d);
  switch (fieldId) {
    case 'year':         return String(y);
    case 'year_quarter': return String(y) + 'Q' + quarter;
    case 'year_month':   return String(y) + pad2(m);
    case 'year_week':    return String(iso.year) + pad2(iso.week);
    case 'quarter':      return String(quarter);
    case 'month':        return pad2(m);
    case 'week':         return pad2(iso.week);
    case 'day_of_week':  return String(dow);
  }
  return '';
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

// ISO 8601 week calculation — week starts Monday; week 1 is the one
// containing the first Thursday of the year. Returns {year, week} since
// dates in late Dec / early Jan can span ISO years (e.g. 2024-12-30 is
// 2025-W01 under ISO 8601).
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

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Coerce a raw value into what Looker Studio expects per field type.
function formatValue(value, fieldId) {
  if (value === null || value === undefined || value === '') {
    // 0 is safer than '' for numeric fields — avoids chart gaps.
    if (isNumericField(fieldId)) return 0;
    return '';
  }

  if (fieldId === 'date_start' || fieldId === 'date_stop') {
    return String(value).replace(/-/g, '').slice(0, 8);
  }

  // Percent fields (CTR, hook rate, etc.) come back as ratios (0.05 = 5%).
  // Pass through as-is — Looker's PERCENT type handles display formatting.
  if (PERCENT_FIELD_IDS[fieldId]) {
    var pct = typeof value === 'number' ? value : Number(value);
    return isNaN(pct) ? 0 : pct;
  }

  // Creative fields are text/URL/IMAGE — never coerce. A video id like
  // "123456789" must stay a string or Looker compares it as a number.
  if (CREATIVE_FIELD_IDS[fieldId]) return String(value);

  // Date rollup fields are pre-formatted strings ("2026Q1", "202604",
  // "12"). Coercing "2026Q1" to a number produces NaN; coercing "04" to
  // 4 breaks the Looker format expectation. Pass through as-is.
  if (DATE_ROLLUP_FIELD_IDS[fieldId]) return String(value);

  // Breakdown dimensions (age "25-34", country "AU", platform "feed")
  // are always strings — skip numeric coercion.
  if (BREAKDOWN_DIMENSIONS[fieldId]) return String(value);

  var numeric = typeof value === 'number'
    ? value
    : (typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : null);

  if (numeric !== null) return numeric;
  return value;
}

// Rough check whether a field expects a number. Used to decide whether an
// empty response should become 0 or ''.
function isNumericField(fieldId) {
  if (ACTION_FIELD_MAP[fieldId]) return true;
  if (VIDEO_SUM_FIELDS[fieldId]) return true;
  // Creative fields are text/URL/IMAGE — an empty thumbnail should stay
  // empty, not become 0.
  if (CREATIVE_FIELD_IDS[fieldId]) return false;
  // Date rollups are strings (e.g. "2026Q1").
  if (DATE_ROLLUP_FIELD_IDS[fieldId]) return false;
  // Breakdown dimensions are strings.
  if (BREAKDOWN_DIMENSIONS[fieldId]) return false;
  // Lazy check — scalar metrics are any id not in our dimension set.
  for (var i = 0; i < DIMENSIONS.length; i++) if (DIMENSIONS[i].id === fieldId) return false;
  return true;
}

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
