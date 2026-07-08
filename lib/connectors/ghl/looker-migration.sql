-- GoHighLevel per-location connections for Looker Studio connector.
--
-- Each row represents one GHL sub-account (location) with its own
-- Private Integration Token. Multiple locations per company.

-- Drop the old agency-level table (no longer used)
DROP TABLE IF EXISTS ghl_agency_connections;

CREATE TABLE IF NOT EXISTS ghl_looker_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  location_id         TEXT NOT NULL,            -- GHL location/sub-account ID
  location_name       TEXT NOT NULL,            -- user-entered display name
  api_token_encrypted TEXT NOT NULL,            -- AES-256-GCM encrypted PIT
  token_valid         BOOLEAN NOT NULL DEFAULT true,
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, location_id)
);

ALTER TABLE ghl_looker_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON ghl_looker_connections
  FOR ALL
  USING (false)
  WITH CHECK (false);
