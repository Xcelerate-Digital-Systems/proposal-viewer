-- Reviewer note: optional greeting the project owner leaves for anyone who
-- opens the shared review link. Shown once as a modal; dismissal is tracked
-- client-side via localStorage keyed on share_token + reviewer_note_updated_at.
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/reviewer-note-migration.sql

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS reviewer_note text,
  ADD COLUMN IF NOT EXISTS reviewer_note_show boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewer_note_updated_at timestamptz;

COMMENT ON COLUMN review_projects.reviewer_note IS
  'Optional note shown to reviewers as a greeting overlay on first load of the shared link.';
COMMENT ON COLUMN review_projects.reviewer_note_show IS
  'When true, the reviewer_note is shown to reviewers until they dismiss it.';
COMMENT ON COLUMN review_projects.reviewer_note_updated_at IS
  'Bumped whenever reviewer_note changes so the client can invalidate its ack and re-show the note.';
