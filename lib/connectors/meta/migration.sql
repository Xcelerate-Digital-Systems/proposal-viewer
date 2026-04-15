-- Meta → Looker Studio connector (passthrough).
--
-- Design:
--   * No insights data is stored. Every /connector/data request fetches from
--     Meta in real time (Looker Studio caches the response for ~12h).
--   * Only persisted state: which company has connected which Meta user, and
--     which of that user's ad accounts they've exposed to the connector.
--   * Access tokens are encrypted app-side (AES-256-GCM) before storage.
--   * meta_oauth_states holds short-lived CSRF tokens during the OAuth dance.

CREATE TABLE IF NOT EXISTS meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meta_user_id TEXT NOT NULL,                -- Facebook user id (from /me)
  meta_user_name TEXT,                       -- display name for the UI
  access_token_encrypted TEXT NOT NULL,      -- AES-256-GCM; see lib/connectors/meta/token-crypto.ts
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'needs_reauth' | 'revoked'
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_connections_company_user
  ON meta_connections(company_id, meta_user_id);
CREATE INDEX IF NOT EXISTS idx_meta_connections_expires_at
  ON meta_connections(expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  connection_id UUID NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,               -- act_XXXXX
  account_name TEXT,
  currency TEXT,
  timezone_name TEXT,
  business_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_enabled
  ON meta_ad_accounts(connection_id) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS meta_oauth_states (
  state_hash TEXT PRIMARY KEY,               -- sha256 hex of the csrf state
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,                     -- team_member.user_id who initiated
  redirect_to TEXT,                          -- optional post-callback redirect
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_oauth_states_expires
  ON meta_oauth_states(expires_at);
