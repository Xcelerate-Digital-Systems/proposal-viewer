-- Add google_merchant_center_email to agency_access_config
-- and google_merchant_center to the AccessPlatform valid set

ALTER TABLE agency_access_config
  ADD COLUMN IF NOT EXISTS google_merchant_center_email TEXT;
