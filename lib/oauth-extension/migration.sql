-- OAuth-style extension login — short-lived authorization codes.
--
-- Flow:
--   1. User approves on /oauth/extension/authorize. Server creates a row in
--      api_keys (the long-lived token) AND a row here holding the plaintext
--      token plus a random code. The code is returned to the extension via
--      the launchWebAuthFlow redirect fragment.
--   2. Extension POSTs the code to /api/oauth/extension/exchange. Server
--      looks up the row, marks it consumed, and returns the plaintext token.
--
-- Rows expire after 2 minutes. Consumed rows have their plaintext wiped
-- immediately — the api_keys row remains as the persistent credential.

CREATE TABLE IF NOT EXISTS oauth_extension_codes (
  code_hash TEXT PRIMARY KEY,             -- sha256 hex of the one-time code
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  plaintext_token TEXT,                   -- the av_live_… token; nulled on consume
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_extension_codes_expires
  ON oauth_extension_codes(expires_at);
