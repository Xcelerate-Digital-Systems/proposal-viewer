-- Client Access feature — database schema
-- Tables for one-click client access/auth granting (Leadsie-style)

-- Agency platform configuration (one row per agency)
CREATE TABLE IF NOT EXISTS agency_access_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  meta_business_id text,
  meta_business_name text,
  google_mcc_id text,
  google_mcc_name text,
  google_analytics_email text,
  google_gtm_email text,
  wordpress_admin_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agency_access_config ENABLE ROW LEVEL SECURITY;
-- No RLS policies — service-role only via API routes

-- Client access requests (one per access link sent to a client)
CREATE TABLE IF NOT EXISTS client_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  share_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'complete', 'expired', 'revoked')),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name text,
  client_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_access_requests_company
  ON client_access_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_client_access_requests_token
  ON client_access_requests(share_token);
CREATE INDEX IF NOT EXISTS idx_client_access_requests_client
  ON client_access_requests(client_id);

ALTER TABLE client_access_requests ENABLE ROW LEVEL SECURITY;
-- No RLS policies — service-role only via API routes

-- Per-platform grants (one row per platform per request)
CREATE TABLE IF NOT EXISTS client_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES client_access_requests(id) ON DELETE CASCADE,
  platform text NOT NULL
    CHECK (platform IN ('meta', 'google_ga4', 'google_gtm', 'google_ads', 'wordpress')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'oauth_complete', 'request_sent', 'granted', 'failed', 'self_reported')),
  oauth_token_encrypted text,
  oauth_refresh_token_encrypted text,
  token_expires_at timestamptz,
  platform_user_id text,
  platform_user_name text,
  platform_account_id text,
  platform_account_name text,
  partner_request_id text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_client_access_grants_request
  ON client_access_grants(request_id);

ALTER TABLE client_access_grants ENABLE ROW LEVEL SECURITY;
-- No RLS policies — service-role only via API routes

-- CSRF state for public OAuth flows (separate from meta_oauth_states)
CREATE TABLE IF NOT EXISTS client_access_oauth_states (
  state_hash text PRIMARY KEY,
  access_request_id uuid NOT NULL REFERENCES client_access_requests(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES client_access_grants(id) ON DELETE CASCADE,
  platform text NOT NULL,
  redirect_token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_access_oauth_states ENABLE ROW LEVEL SECURITY;
-- No RLS policies — service-role only via API routes

-- Add client_access_limit to plans table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS client_access_limit integer;

-- Revoke direct access from anon/authenticated roles (service-role only)
REVOKE ALL ON agency_access_config FROM anon, authenticated;
REVOKE ALL ON client_access_requests FROM anon, authenticated;
REVOKE ALL ON client_access_grants FROM anon, authenticated;
REVOKE ALL ON client_access_oauth_states FROM anon, authenticated;

GRANT ALL ON agency_access_config TO service_role;
GRANT ALL ON client_access_requests TO service_role;
GRANT ALL ON client_access_grants TO service_role;
GRANT ALL ON client_access_oauth_states TO service_role;
