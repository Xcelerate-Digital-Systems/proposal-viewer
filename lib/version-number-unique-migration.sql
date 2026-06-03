-- Prevent duplicate version numbers within the same item.
-- If duplicates already exist, deduplicate them first.
DO $$
DECLARE
  r RECORD;
  new_num int;
BEGIN
  FOR r IN
    SELECT id, review_item_id, version_number,
           ROW_NUMBER() OVER (PARTITION BY review_item_id, version_number ORDER BY created_at) AS rn
      FROM review_item_versions
  LOOP
    IF r.rn > 1 THEN
      SELECT COALESCE(MAX(version_number), 0) + 1
        INTO new_num
        FROM review_item_versions
       WHERE review_item_id = r.review_item_id;
      UPDATE review_item_versions SET version_number = new_num WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Now safe to add the unique constraint
ALTER TABLE review_item_versions
  ADD CONSTRAINT review_item_versions_item_version_unique
  UNIQUE (review_item_id, version_number);
