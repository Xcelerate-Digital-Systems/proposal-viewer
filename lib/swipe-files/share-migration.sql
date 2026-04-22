-- Swipe File — cross-company sharing at the folder (type) level.
--
-- A swipe_types row is owned by exactly one company (company_id).
-- shared_with_company_ids is the set of additional company_ids that should
-- also be able to read the folder + read/write its files. The owner
-- retains exclusive control over the folder metadata and share list.

ALTER TABLE swipe_types
  ADD COLUMN IF NOT EXISTS shared_with_company_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_swipe_types_shared_with
  ON swipe_types USING GIN (shared_with_company_ids);
