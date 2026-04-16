// OAuth.gs
//
// Looker Studio Community Connector auth hooks. Uses KEY auth — the user
// pastes their AgencyViz API key (av_live_...) directly into the connector
// config. This avoids the OAuth2 redirect-back-to-script.google.com flow
// which breaks when the user has multiple Google accounts logged in.

function getAuthType() {
  var cc = DataStudioApp.createCommunityConnector();
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.KEY)
    .setHelpUrl(API_BASE + '/integrations/looker-studio')
    .build();
}

// Called by Looker Studio to check if the stored credentials are still valid.
function isAuthValid() {
  var key = getApiKey();
  if (!key) return false;

  // Quick validation: hit the accounts endpoint to confirm the key works.
  try {
    var resp = UrlFetchApp.fetch(API_BASE + '/api/connectors/meta/accounts', {
      method: 'get',
      headers: { Authorization: 'Bearer ' + key },
      muteHttpExceptions: true,
    });
    return resp.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

// Called when the user submits their key in the Looker Studio auth screen.
function setCredentials(request) {
  var key = request.key;
  if (!key || key.indexOf('av_live_') !== 0) {
    return { errorCode: 'INVALID_CREDENTIALS' };
  }
  PropertiesService.getUserProperties().setProperty('av_api_key', key);
  return { errorCode: 'NONE' };
}

// Called when the user disconnects the connector in Looker Studio.
function resetAuth() {
  PropertiesService.getUserProperties().deleteProperty('av_api_key');
}

// Internal helper — returns the stored API key or null.
function getApiKey() {
  return PropertiesService.getUserProperties().getProperty('av_api_key');
}
