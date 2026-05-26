-- Adds an explicit company / brand name to feedback projects so creative
-- previews (Meta ads, email senders, etc.) can render the *brand* instead
-- of the contact person's name. The existing `client_name` column stays
-- as the contact (e.g. "Mia Gordan") while `client_company` holds the
-- brand (e.g. "Premier Shipping Containers").
--
-- Apply via:
--   psql "$DATABASE_URL" -f lib/feedback/client-company-migration.sql
-- or paste into the Supabase SQL editor.

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS client_company text;

COMMENT ON COLUMN review_projects.client_company IS
  'Brand / company name shown in creative previews (Meta ad page name, email sender, etc.). client_name remains the contact person.';
