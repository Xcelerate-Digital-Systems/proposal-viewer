-- Reviewer completion log: one row every time a reviewer clicks
-- "Let the team know you finished reviewing" on a public review link.
-- The row is what drives the "review_feedback_marked_complete" webhook
-- event; it also gives the team a future source of truth for a
-- completions report.
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/complete-feedback-migration.sql

CREATE TABLE IF NOT EXISTS review_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_project_id uuid NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  reviewer_name text,
  reviewer_email text,
  message text,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_completions_project_idx
  ON review_completions(review_project_id, completed_at DESC);

COMMENT ON TABLE review_completions IS
  'One row per reviewer clicking "Let the team know you finished reviewing" on a shared review link.';
