-- Swipe File — drop the legacy is_standard column.
--
-- Originally used to mark the 18 auto-seeded "standard" ad-type folders so
-- they couldn't be renamed or deleted. The seed has been removed and every
-- folder is now fully user-editable, so this column is no longer read or
-- written by application code.

ALTER TABLE swipe_types
  DROP COLUMN IF EXISTS is_standard;
