-- Comment Assignments Migration
-- Adds lightweight task assignment to review comments (internal-only).
-- An assignment = one team member assigned to fix/action a comment,
-- with optional instructions and a completed_at timestamp.

ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS assigned_to       uuid REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by       uuid REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_note   text,
  ADD COLUMN IF NOT EXISTS assignment_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_review_comments_assigned_to
  ON review_comments (assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN review_comments.assigned_to IS 'Team member responsible for actioning this comment';
COMMENT ON COLUMN review_comments.assigned_by IS 'Team member who created the assignment';
COMMENT ON COLUMN review_comments.assignment_note IS 'Additional instructions for the assignee';
COMMENT ON COLUMN review_comments.assignment_completed_at IS 'When the assignee marked the assignment done (null = open)';
