// Config.gs
//
// The ONLY values you should need to change when moving between environments.
// Everything else in this Apps Script project should be stable across clients.
//
// ⚠ Do NOT paste the real OAUTH_CLIENT_SECRET into this file if you plan to
//   check it into version control. The values below are placeholders; the
//   real credentials live in the Apps Script project editor only.

var API_BASE = 'https://app.agencyviz.io';

// Issued by the AgencyViz OAuth backend. Registered in the oauth_clients
// table with a hashed secret. Retrieve the plaintext from your AgencyViz
// handover notes or by re-registering the client.
var OAUTH_CLIENT_ID = 'REPLACE_WITH_CLIENT_ID';
var OAUTH_CLIENT_SECRET = 'REPLACE_WITH_CLIENT_SECRET';
