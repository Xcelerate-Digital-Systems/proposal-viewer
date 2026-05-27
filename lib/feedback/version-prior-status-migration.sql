-- ============================================================================
-- Per-version status history: snapshot the predecessor's stage when a new
-- version is uploaded.
-- ============================================================================
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/version-prior-status-migration.sql
--
-- We don't keep a full status-events log. Instead each `review_item_versions`
-- row records the stage the item was in *at the moment this version was
-- created* — i.e. where the predecessor version ended up before being
-- superseded. That gives the VersionPicker dropdown enough info to render a
-- "v1 — Approved" / "v2 — Revision Needed" badge per row.
--
-- For the active (latest) version, the live status comes from
-- review_items.status; for any older version v[N], its display status is
-- v[N+1].prior_status. v1 doesn't have a row in review_item_versions, so its
-- display status when superseded comes from review_item_versions[v2].prior_status.
-- ============================================================================

BEGIN;

ALTER TABLE review_item_versions
  ADD COLUMN IF NOT EXISTS prior_status text;

COMMENT ON COLUMN review_item_versions.prior_status IS
  'review_items.status at the moment this version was inserted. Stable: never updated. Tells the VersionPicker what stage the predecessor version was in when it got superseded.';

CREATE OR REPLACE FUNCTION set_review_version_prior_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.prior_status IS NULL AND NEW.review_item_id IS NOT NULL THEN
    SELECT status INTO NEW.prior_status
    FROM review_items
    WHERE id = NEW.review_item_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_review_version_prior_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_review_version_prior_status() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION set_review_version_prior_status() TO service_role;

DROP TRIGGER IF EXISTS trg_set_review_version_prior_status ON review_item_versions;
CREATE TRIGGER trg_set_review_version_prior_status
  BEFORE INSERT ON review_item_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_review_version_prior_status();

-- Backfill: for existing rows, set prior_status to the item's *current* status.
-- This is imperfect — we don't have history of what the stage was when each
-- old version was uploaded — but it's a reasonable default for rows that
-- predate this column. Anything inserted post-migration will be exact.
UPDATE review_item_versions v
SET prior_status = i.status
FROM review_items i
WHERE v.review_item_id = i.id
  AND v.prior_status IS NULL;

COMMIT;
