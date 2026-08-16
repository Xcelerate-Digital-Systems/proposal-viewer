-- Add universal share token, default platforms, and agency OAuth fields to agency_access_config
ALTER TABLE agency_access_config
  ADD COLUMN IF NOT EXISTS universal_share_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS default_platforms jsonb DEFAULT '["meta","google_ga4","google_gtm","google_ads","wordpress"]'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_user_id text,
  ADD COLUMN IF NOT EXISTS meta_user_name text,
  ADD COLUMN IF NOT EXISTS meta_token_encrypted text,
  ADD COLUMN IF NOT EXISTS google_user_name text,
  ADD COLUMN IF NOT EXISTS google_refresh_token_encrypted text;

CREATE INDEX IF NOT EXISTS idx_agency_access_config_universal_token
  ON agency_access_config(universal_share_token);
