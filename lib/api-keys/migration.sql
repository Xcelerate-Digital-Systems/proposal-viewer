-- API Keys — for external clients (Chrome extension, integrations) to call
-- Agency Viz API routes without using a Supabase user session.
--
-- Keys are stored as SHA-256 hashes; the plaintext is shown to the user
-- exactly once at creation time. A short prefix is stored alongside the hash
-- so users can identify a key in the UI ("av_live_a1b2…").

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,           -- first ~12 chars of plaintext, for display
  key_hash TEXT NOT NULL UNIQUE,      -- sha256 hex of full plaintext
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
