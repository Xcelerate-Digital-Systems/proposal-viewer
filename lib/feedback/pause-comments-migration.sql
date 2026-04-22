-- Pause-new-comments switch: admin-only flag that temporarily stops
-- reviewers from leaving new comments on a shared link. Existing comments
-- stay visible; only the composer is gated.
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/pause-comments-migration.sql

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS pause_new_comments boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN review_projects.pause_new_comments IS
  'Admin-controlled switch. When true, reviewers see a "comments paused" banner and the composer is disabled on the public review page. Existing comments are unaffected.';
