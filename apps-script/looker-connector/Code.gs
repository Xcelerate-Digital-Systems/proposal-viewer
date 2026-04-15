// Code.gs
//
// Entry point for the AgencyViz Facebook Ads community connector. Looker
// Studio lifecycle:
//   1. getAuthType()           — tell Looker Studio we use OAuth2
//   2. getConfig()             — render the ad-account picker
//   3. getSchema()             — declare available fields
//   4. getData()               — fetch rows for the current report query

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
    // Surface the error inside the config — users often miss toast banners.
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

  var requestedFieldNames = (request.fields || []).map(function (f) { return f.name; });
  var allFields = getFields();
  var scopedFields = allFields.forIds(requestedFieldNames);

  var body = {
    ad_account_id: adAccountId,
    date_from: request.dateRange.startDate,
    date_to: request.dateRange.endDate,
    fields: requestedFieldNames,
    level: 'ad',
  };

  var resp;
  try {
    resp = callApi('/api/connectors/meta/data', 'POST', body);
  } catch (e) {
    throwUserError('Could not fetch data from Facebook: ' + e.message);
  }

  var rawRows = (resp && resp.data && resp.data.rows) || [];
  var rows = rawRows.map(function (r) {
    return {
      values: requestedFieldNames.map(function (name) {
        return formatValue(r[name], name);
      }),
    };
  });

  return { schema: scopedFields.build(), rows: rows };
}

// Meta returns ISO dates; Looker Studio wants YEAR_MONTH_DAY as 'YYYYMMDD'.
// Numeric strings need to be coerced to numbers. Missing values become ''.
function formatValue(value, fieldName) {
  if (value === null || value === undefined) return '';
  if (fieldName === 'date_start' || fieldName === 'date_stop') {
    // '2026-04-15' → '20260415'
    return String(value).replace(/-/g, '').slice(0, 8);
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

// Surfaces a nice error inside Looker Studio instead of a generic stack trace.
function throwUserError(message) {
  var cc = DataStudioApp.createCommunityConnector();
  cc.newUserError().setText(message).throwException();
}

// Wrapper around UrlFetchApp that injects the current OAuth access token.
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
    // Token rejected — force a re-auth on the next request.
    service.reset();
    throw new Error('Session expired. Reconnect the connector to continue.');
  }
  if (code >= 400) {
    throw new Error('API ' + code + ': ' + text.slice(0, 200));
  }
  return JSON.parse(text);
}

// Used by Looker Studio's in-app admin features. Return true only for
// accounts you want to be able to preview unreleased versions of the
// connector. Safe default: false.
function isAdminUser() {
  return false;
}
