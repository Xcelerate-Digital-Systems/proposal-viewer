-- GoHighLevel Agency-level connection for Looker Studio connector.
--
-- Separate from ghl_connections (sub-account CRM sync). This stores an
-- agency-level Private Integration Token that can list all locations and
-- query any sub-account's data for Looker Studio reporting.

CREATE TABLE IF NOT EXISTS ghl_agency_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  api_token_encrypted TEXT NOT NULL,        -- AES-256-GCM; same key as ghl_connections
  agency_name         TEXT,                 -- cached from /locations/search or user input
  token_valid         BOOLEAN NOT NULL DEFAULT true,
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ghl_agency_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON ghl_agency_connections
  FOR ALL
  USING (false)
  WITH CHECK (false);
