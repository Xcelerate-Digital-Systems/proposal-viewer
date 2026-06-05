-- ============================================================================
-- Project-level general comments
-- ============================================================================
--
-- Allow comments to be posted at the campaign (project) level without being
-- tied to a specific asset/item. This enables "general feedback" threads in
-- the comments tab.
--
-- Changes:
--   1. Make review_item_id nullable (was NOT NULL).
--   2. Add review_project_id column (nullable FK).
--   3. CHECK: at least one of review_item_id / review_project_id is set.
--   4. Index on review_project_id for the comments-tab query.
--   5. Update stage-snapshot trigger to handle NULL review_item_id (already
--      guarded by IF NEW.review_item_id IS NOT NULL — no change needed).
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/general-comments-migration.sql
-- ============================================================================

BEGIN;

-- 1. Allow NULL on review_item_id
ALTER TABLE review_comments
  ALTER COLUMN review_item_id DROP NOT NULL;

-- 2. Add project-level FK
ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS review_project_id uuid REFERENCES review_projects(id) ON DELETE CASCADE;

-- 3. Every comment must belong to either an item or a project (or both)
ALTER TABLE review_comments
  DROP CONSTRAINT IF EXISTS chk_review_comments_item_or_project;
ALTER TABLE review_comments
  ADD CONSTRAINT chk_review_comments_item_or_project
  CHECK (review_item_id IS NOT NULL OR review_project_id IS NOT NULL);

-- 4. Index for fetching project-level comments
CREATE INDEX IF NOT EXISTS idx_review_comments_review_project_id
  ON review_comments(review_project_id)
  WHERE review_project_id IS NOT NULL;

-- 5. RLS: allow authenticated users to SELECT project-level comments by
--    company_id (existing item-based policies already cover item-level rows).
--    This policy is additive — it does NOT replace existing policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'review_comments'
      AND policyname = 'select_project_comments_by_company'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY select_project_comments_by_company
        ON review_comments FOR SELECT
        USING (
          review_project_id IS NOT NULL
          AND company_id IN (
            SELECT tm.company_id FROM team_members tm
            WHERE tm.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END
$$;

-- 6. INSERT policy for project-level comments (mirrors existing item-level pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'review_comments'
      AND policyname = 'insert_project_comments_by_company'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY insert_project_comments_by_company
        ON review_comments FOR INSERT
        WITH CHECK (
          review_project_id IS NOT NULL
          AND company_id IN (
            SELECT tm.company_id FROM team_members tm
            WHERE tm.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END
$$;

COMMIT;
