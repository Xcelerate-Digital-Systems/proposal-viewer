-- ============================================================================
-- Unified review status migration
-- ============================================================================
--
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Replaces the separate project (active/completed/archived) and item
-- (draft/in_review/approved/revision_needed) status vocabularies with a single
-- 7-value workflow applied to both tables.
--
-- New status values (applied to review_projects.status + review_items.status):
--   draft, internal_review, external_review, client_review,
--   revisions_completed, approved, archived
--
-- Mapping (existing -> new):
--   Items:
--     draft           -> draft
--     in_review       -> internal_review
--     approved        -> approved
--     revision_needed -> client_review
--   Projects:
--     active          -> internal_review
--     completed       -> approved
--     archived        -> archived
-- ============================================================================

BEGIN;

-- Drop existing CHECK constraints if present (names may differ across envs)
ALTER TABLE review_items  DROP CONSTRAINT IF EXISTS review_items_status_check;
ALTER TABLE review_projects DROP CONSTRAINT IF EXISTS review_projects_status_check;

-- Remap existing rows
UPDATE review_items
SET status = CASE status
  WHEN 'in_review'       THEN 'internal_review'
  WHEN 'revision_needed' THEN 'client_review'
  ELSE status
END;

UPDATE review_projects
SET status = CASE status
  WHEN 'active'    THEN 'internal_review'
  WHEN 'completed' THEN 'approved'
  ELSE status
END;

-- Enforce the new enum via CHECK constraints
ALTER TABLE review_items
  ADD CONSTRAINT review_items_status_check
  CHECK (status IN (
    'draft',
    'internal_review',
    'external_review',
    'client_review',
    'revisions_completed',
    'approved',
    'archived'
  ));

ALTER TABLE review_projects
  ADD CONSTRAINT review_projects_status_check
  CHECK (status IN (
    'draft',
    'internal_review',
    'external_review',
    'client_review',
    'revisions_completed',
    'approved',
    'archived'
  ));

-- Reset defaults
ALTER TABLE review_items    ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE review_projects ALTER COLUMN status SET DEFAULT 'internal_review';

COMMIT;
