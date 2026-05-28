-- Comment Tasks Migration
-- Replaces the single-assignee columns on review_comments with a proper
-- junction table supporting multiple assignees, per-assignee instructions,
-- attachments, and independent completion tracking.

-- 1. Create the new tasks table
CREATE TABLE IF NOT EXISTS comment_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id    uuid NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_to   uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  assigned_by   uuid REFERENCES team_members(id) ON DELETE SET NULL,
  instructions  text,
  attachments   jsonb DEFAULT '[]'::jsonb,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_tasks_comment_id
  ON comment_tasks (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_tasks_assigned_to
  ON comment_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_comment_tasks_company_id
  ON comment_tasks (company_id);

COMMENT ON TABLE  comment_tasks IS 'Action items created from review comments — one row per assignee';
COMMENT ON COLUMN comment_tasks.instructions IS 'Per-assignee instructions for what needs fixing';
COMMENT ON COLUMN comment_tasks.attachments IS 'JSON array of { path, name, size, type } objects in company-assets bucket';
COMMENT ON COLUMN comment_tasks.completed_at IS 'When the assignee marked this task done (null = open)';

-- 2. Migrate existing single-assignee data into the new table
INSERT INTO comment_tasks (comment_id, company_id, assigned_to, assigned_by, instructions, completed_at, created_at)
SELECT
  id,
  company_id,
  assigned_to,
  assigned_by,
  assignment_note,
  assignment_completed_at,
  COALESCE(updated_at, created_at, now())
FROM review_comments
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop the old columns (now redundant)
ALTER TABLE review_comments
  DROP COLUMN IF EXISTS assigned_to,
  DROP COLUMN IF EXISTS assigned_by,
  DROP COLUMN IF EXISTS assignment_note,
  DROP COLUMN IF EXISTS assignment_completed_at;

-- 4. Drop the old index (column no longer exists)
DROP INDEX IF EXISTS idx_review_comments_assigned_to;

-- 5. RLS policies for comment_tasks
ALTER TABLE comment_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on comment_tasks"
  ON comment_tasks FOR ALL
  USING (true)
  WITH CHECK (true);

-- Team members can read tasks for their company
CREATE POLICY "Team members can read own company tasks"
  ON comment_tasks FOR SELECT
  USING (
    company_id IN (
      SELECT tm.company_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Team members can update tasks assigned to them (mark complete)
CREATE POLICY "Assignees can update own tasks"
  ON comment_tasks FOR UPDATE
  USING (
    assigned_to IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_to IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );
