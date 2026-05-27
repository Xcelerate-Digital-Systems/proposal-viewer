-- ============================================================================
-- Per-stage assignee scoping (Filestage-style)
-- ============================================================================
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/stage-assignees-migration.sql
--
-- Each project assignee (team member or guest) can now be scoped to a subset
-- of pipeline stages. When an item enters a stage, only assignees whose
-- `stages` array contains that stage (or whose array is empty — meaning "all
-- stages", preserved for back-compat) are eligible for notifications.
--
-- UI surfaces this as a `+` button on each Kanban column header: clicking it
-- adds the picked member/guest to that stage's `stages` array.
-- ============================================================================

BEGIN;

-- --- review_project_assignees (team members) ---------------------------------

ALTER TABLE review_project_assignees
  ADD COLUMN IF NOT EXISTS stages text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN review_project_assignees.stages IS
  'Pipeline stages this assignee participates in. Empty array means all stages (back-compat for rows created before per-stage scoping shipped). Values must match lib/types/feedback.ts > FeedbackStatus.';

-- CHECK constraint: every element of `stages` must be a known FeedbackStatus.
-- archived/rejected included so admins can opt-in to terminal-state pings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_project_assignees_stages_valid'
  ) THEN
    ALTER TABLE review_project_assignees
      ADD CONSTRAINT review_project_assignees_stages_valid
      CHECK (
        stages <@ ARRAY[
          'draft', 'in_progress', 'internal_review', 'client_review',
          'revision_needed', 'approved', 'rejected', 'archived'
        ]::text[]
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_review_project_assignees_stages
  ON review_project_assignees USING GIN (stages);

-- --- review_project_guest_recipients (external/client emails) ----------------

ALTER TABLE review_project_guest_recipients
  ADD COLUMN IF NOT EXISTS stages text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN review_project_guest_recipients.stages IS
  'Pipeline stages this guest receives notifications for. Empty means all stages (back-compat). Guest visibility of items in the public viewer is still status-based (client_review/approved/rejected) — this column controls notification routing only.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_project_guest_recipients_stages_valid'
  ) THEN
    ALTER TABLE review_project_guest_recipients
      ADD CONSTRAINT review_project_guest_recipients_stages_valid
      CHECK (
        stages <@ ARRAY[
          'draft', 'in_progress', 'internal_review', 'client_review',
          'revision_needed', 'approved', 'rejected', 'archived'
        ]::text[]
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_review_project_guest_recipients_stages
  ON review_project_guest_recipients USING GIN (stages);

COMMIT;
