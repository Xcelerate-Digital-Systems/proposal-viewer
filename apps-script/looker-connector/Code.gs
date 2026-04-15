// Code.gs
//
// Entry point for the AgencyViz Facebook Ads community connector. Looker
// Studio lifecycle:
//   1. getAuthType()  — OAuth.gs
//   2. getConfig()    — ad-account picker
//   3. getSchema()    — Schema.gs
//   4. getData()      — this file; handles action-based field expansion

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  config
    .newInfo()
    .setId('intro')
    .setText(
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
  var allFields = getFields();
  var scopedFields = allFields.forIds(requestedFieldIds);

  // Expand synthetic ids (e.g. purchases, leads) to the underlying Meta API
  // fields they depend on (actions, action_values). Dedup so we don't send
  // the same field twice to the API.
  var apiFieldSet = {};
  requestedFieldIds.forEach(function (id) {
    if (ACTION_FIELD_MAP[id]) {
      apiFieldSet[ACTION_FIELD_MAP[id].from] = true;
    } else {
      apiFieldSet[id] = true;
    }
  });
  var apiFields = Object.keys(apiFieldSet);

  var body = {
    ad_account_id: adAccountId,
    date_from: request.dateRange.startDate,
    date_to: request.dateRange.endDate,
    fields: apiFields,
    level: 'ad',
  };

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

// Resolve a Looker Studio field id to a scalar value out of a Meta API row.
// Handles both native scalars (impressions, spend, …) and synthetic fields
// that need us to look inside the `actions` / `action_values` arrays.
function resolveFieldValue(row, fieldId) {
  var mapping = ACTION_FIELD_MAP[fieldId];
  if (!mapping) return row[fieldId];

  var arr = row[mapping.from];
  if (!Array.isArray(arr)) return 0;

  // Match the first action_type in our priority list that exists on the row.
  // Falls back to 0 if none match — better than crashing on a dead pixel.
  for (var i = 0; i < mapping.types.length; i++) {
    var wanted = mapping.types[i];
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].action_type === wanted) {
        var v = arr[j].value;
        return typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : v;
      }
    }
  }
  return 0;
}

// Coerce values into the shapes Looker Studio expects per field type.
function formatValue(value, fieldId) {
  if (value === null || value === undefined || value === '') return '';

  if (fieldId === 'date_start' || fieldId === 'date_stop') {
    // Meta returns 'YYYY-MM-DD'; Looker Studio YEAR_MONTH_DAY wants 'YYYYMMDD'.
    return String(value).replace(/-/g, '').slice(0, 8);
  }

  // purchase_roas is returned as an array of {action_type,value} in some API
  // versions; handle both shapes.
  if (fieldId === 'purchase_roas' && Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      if (value[i].action_type === 'omni_purchase'
          || value[i].action_type === 'offsite_conversion.fb_pixel_purchase'
          || value[i].action_type === 'purchase') {
        return Number(value[i].value);
      }
    }
    return 0;
  }

  var numeric = typeof value === 'number'
    ? value
    : (typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : null);

  if (numeric !== null) {
    // PERCENT in Looker Studio = fraction (0.05 means 5%). Meta returns a
    // percentage number (5.0 means 5%). Divide to line them up.
    if (PERCENT_FIELD_IDS.indexOf(fieldId) !== -1) return numeric / 100;
    return numeric;
  }

  return value;
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
