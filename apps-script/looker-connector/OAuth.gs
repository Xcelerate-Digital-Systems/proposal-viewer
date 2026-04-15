// OAuth.gs
//
// Looker Studio Community Connector OAuth2 hooks. The heavy lifting is done
// by the apps-script-oauth2 library (loaded via appsscript.json as "OAuth2").

function getAuthType() {
  var cc = DataStudioApp.createCommunityConnector();
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.OAUTH2)
    .build();
}

// Central OAuth service factory. Called by Looker Studio lifecycle functions
// and by the data/config fetchers when they need a Bearer token.
function getOAuthService() {
  return OAuth2.createService('AgencyViz')
    .setAuthorizationBaseUrl(API_BASE + '/oauth/authorize')
    .setTokenUrl(API_BASE + '/api/oauth/token')
    .setClientId(OAUTH_CLIENT_ID)
    .setClientSecret(OAUTH_CLIENT_SECRET)
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties());
}

function isAuthValid() {
  return getOAuthService().hasAccess();
}

// Called when Looker Studio needs the URL to pop up for the user to authorize.
function get3PAuthorizationUrls() {
  return getOAuthService().getAuthorizationUrl();
}

// The redirect URI /oauth/authorize sends the user back to after Approve.
// Must be a top-level function in this Apps Script project; its name is
// referenced in getOAuthService().setCallbackFunction('authCallback').
function authCallback(request) {
  var service = getOAuthService();
  var authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput(
      '<p>Success! You can close this tab and return to Looker Studio.</p>',
    );
  }
  return HtmlService.createHtmlOutput(
    '<p>Authorization denied. You can close this tab.</p>',
  );
}

// Called when the user disconnects the connector in Looker Studio.
function resetAuth() {
  getOAuthService().reset();
}
