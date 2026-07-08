// OAuth.gs
//
// Looker Studio Community Connector OAuth2 hooks for the GHL connector.
// Identical pattern to the Meta connector — authenticates with AgencyViz,
// not with GHL directly (GHL auth is handled server-side via stored PIT).

function getAuthType() {
  var cc = DataStudioApp.createCommunityConnector();
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.OAUTH2)
    .build();
}

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

function get3PAuthorizationUrls() {
  return getOAuthService().getAuthorizationUrl();
}

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

function resetAuth() {
  getOAuthService().reset();
}
