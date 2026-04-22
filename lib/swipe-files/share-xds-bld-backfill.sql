-- One-time backfill: share every Xcelerate Digital Systems (XDS) swipe folder
-- with Black Lion Digital (BLD), and vice versa.
--
-- Safe to re-run: each UPDATE only touches folders that don't already include
-- the target company in their shared_with_company_ids array.
--
-- Run order:
--   1) Apply share-migration.sql first (adds the shared_with_company_ids column).
--   2) Run this script in the Supabase SQL editor.
--
-- If either RAISE EXCEPTION fires, adjust the ILIKE patterns below to match
-- whatever the companies table actually calls them.

DO $$
DECLARE
  xds_id uuid;
  bld_id uuid;
  affected int;
BEGIN
  SELECT id INTO xds_id
  FROM companies
  WHERE name ILIKE '%xcelerate%'
  ORDER BY created_at ASC
  LIMIT 1;
  IF xds_id IS NULL THEN
    RAISE EXCEPTION 'Could not find a companies row matching "%xcelerate%"';
  END IF;

  SELECT id INTO bld_id
  FROM companies
  WHERE name ILIKE '%black lion%'
  ORDER BY created_at ASC
  LIMIT 1;
  IF bld_id IS NULL THEN
    RAISE EXCEPTION 'Could not find a companies row matching "%black lion%"';
  END IF;

  -- XDS folders → also visible/writable to BLD
  UPDATE swipe_types
  SET shared_with_company_ids = array_append(
        COALESCE(shared_with_company_ids, '{}'::uuid[]),
        bld_id
      ),
      updated_at = now()
  WHERE company_id = xds_id
    AND NOT (COALESCE(shared_with_company_ids, '{}'::uuid[]) @> ARRAY[bld_id]);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Shared % XDS folder(s) with BLD (bld_id=%)', affected, bld_id;

  -- BLD folders → also visible/writable to XDS (symmetric sharing)
  UPDATE swipe_types
  SET shared_with_company_ids = array_append(
        COALESCE(shared_with_company_ids, '{}'::uuid[]),
        xds_id
      ),
      updated_at = now()
  WHERE company_id = bld_id
    AND NOT (COALESCE(shared_with_company_ids, '{}'::uuid[]) @> ARRAY[xds_id]);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Shared % BLD folder(s) with XDS (xds_id=%)', affected, xds_id;
END $$;
