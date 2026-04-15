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
  var allFields = getFields();
  var scopedFields = allFields.forIds(requestedFieldIds);

  // Resolve schema ids → Meta API field names. Dedup so we don't waste a
  // slot on e.g. `actions` when three conversion metrics all need it.
  var apiFieldSet = {};
  requestedFieldIds.forEach(function (id) {
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
  if (ACTION_FIELD_MAP[id])   return ACTION_FIELD_MAP[id].from;
  if (VIDEO_SUM_FIELDS[id])   return VIDEO_SUM_FIELDS[id];
  return id;
}

// Pull a scalar value out of an API row for a given schema id.
function resolveFieldValue(row, fieldId) {
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
