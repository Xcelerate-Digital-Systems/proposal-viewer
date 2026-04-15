-- Generic OAuth2 authorization-code flow for third-party integrations
-- (Looker Studio connector, Zapier, Make, etc.). Distinct from
-- oauth_extension_codes which is a simpler single-purpose flow for the
-- Chrome extension.
--
-- Flow:
--   1. Client redirects user to /oauth/authorize with client_id, redirect_uri,
--      state. User must be signed in; they see a consent screen.
--   2. On Approve, server mints an api_keys row + an oauth_auth_codes row
--      and redirects to redirect_uri with ?code=xxx&state=xxx.
--   3. Client POSTs to /api/oauth/token with grant_type=authorization_code,
--      code, client_id, client_secret, redirect_uri. Server validates,
--      consumes the code, returns the plaintext access_token.
--
-- Codes expire after 2 minutes and are single-use. Client secrets are stored
-- hashed (SHA-256) — plaintext is shown exactly once at client registration.

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT NOT NULL,       -- sha256 hex of client_secret
  name TEXT NOT NULL,                     -- displayed on the consent screen
  redirect_uris TEXT[] NOT NULL,          -- exact-match whitelist
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code_hash TEXT PRIMARY KEY,             -- sha256 hex of the one-time code
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,             -- must match the /token call exactly
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  plaintext_token TEXT,                   -- av_live_... token; nulled on consume
  scope TEXT,                             -- optional, for future scope-based authz
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires
  ON oauth_auth_codes(expires_at);
