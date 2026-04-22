-- Per-comment priority for the Creative Review tool.
-- Adds a 4-value enum (high / medium / low / none) as a new column on
-- review_comments. Default 'none' so existing rows don't need a backfill and
-- nothing about current behaviour changes until the UI starts writing values.
--
-- Apply via:
--   psql "$DATABASE_URL" -f lib/feedback/priority-migration.sql
-- or paste into the Supabase SQL editor.

DO $$ BEGIN
  CREATE TYPE review_comment_priority AS ENUM ('high', 'medium', 'low', 'none');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS priority review_comment_priority NOT NULL DEFAULT 'none';

-- Partial index: we only ever filter for non-default priorities, so no point
-- indexing the (overwhelmingly common) 'none' rows.
CREATE INDEX IF NOT EXISTS review_comments_priority_idx
  ON review_comments(review_item_id, priority)
  WHERE priority != 'none';

COMMENT ON COLUMN review_comments.priority IS
  'Author-set urgency for the comment. none = default, high/medium/low = explicit.';
