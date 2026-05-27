-- ============================================================================
-- Snapshot the item's stage at the moment a comment is created.
-- ============================================================================
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/comment-stage-snapshot-migration.sql
--
-- Used by the public viewer to hide internal-stage chatter from guests even
-- after the item later moves to a client-visible stage. Set automatically by
-- BEFORE INSERT trigger so every existing comment-write path (admin, public
-- widget, /api/review-widget, /api/review-comments) snapshots correctly with
-- no application changes.
-- ============================================================================

BEGIN;

ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS stage_at_creation text;

COMMENT ON COLUMN review_comments.stage_at_creation IS
  'review_items.status as of the moment this comment was inserted. Stable: never updated after insert. Used to keep guest views free of comments written while the item was in an internal stage.';

-- Trigger: on insert, if stage_at_creation is null, copy the parent item''s
-- current status. Comments with parent_comment_id inherit the same status
-- (they share the same item).
CREATE OR REPLACE FUNCTION set_review_comment_stage_at_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.stage_at_creation IS NULL AND NEW.review_item_id IS NOT NULL THEN
    SELECT status INTO NEW.stage_at_creation
    FROM review_items
    WHERE id = NEW.review_item_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Service-role only — comment writes are routed through service-role clients
-- in the API layer, so anon/authenticated shouldn't be calling this directly.
REVOKE EXECUTE ON FUNCTION set_review_comment_stage_at_creation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_review_comment_stage_at_creation() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION set_review_comment_stage_at_creation() TO service_role;

DROP TRIGGER IF EXISTS trg_set_review_comment_stage_at_creation ON review_comments;
CREATE TRIGGER trg_set_review_comment_stage_at_creation
  BEFORE INSERT ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_review_comment_stage_at_creation();

-- Backfill existing rows with the item''s *current* status. This is the best
-- we can do — we have no history of what the stage was when each comment was
-- written. For comments authored while the item was internal but the item is
-- now client_review, this will incorrectly mark them as authored in
-- client_review. That's a one-time inaccuracy on existing data; everything
-- after this migration is exact.
UPDATE review_comments c
SET stage_at_creation = i.status
FROM review_items i
WHERE c.review_item_id = i.id
  AND c.stage_at_creation IS NULL;

CREATE INDEX IF NOT EXISTS idx_review_comments_stage_at_creation
  ON review_comments(stage_at_creation);

COMMIT;
