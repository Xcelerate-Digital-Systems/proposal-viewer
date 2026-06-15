-- OAuth refresh token support for Looker Studio connector
-- Adds refresh_token_hash and oauth_client_id to api_keys so the
-- apps-script-oauth2 library can silently renew tokens instead of
-- prompting the user to re-authorize.

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS refresh_token_hash text,
  ADD COLUMN IF NOT EXISTS oauth_client_id text;

CREATE INDEX IF NOT EXISTS idx_api_keys_refresh_token_hash
  ON api_keys (refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL AND revoked_at IS NULL;
