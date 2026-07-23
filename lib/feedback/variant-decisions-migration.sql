-- ============================================================================
-- Per-reviewer approve / request-changes decisions on Meta ad copy variants.
-- ============================================================================
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/variant-decisions-migration.sql
--
-- While `review_item_decisions` tracks per-reviewer votes on the *item* as a
-- whole, this table tracks per-reviewer votes on individual ad copy *variants*
-- within an item. This lets a client say "Headline A is approved, Headline B
-- needs changes" without affecting the item-level status.
--
-- Variants are identified by their stable nanoid (`variant_id` TEXT), which
-- maps to `MetaAdVariant.id` in the TypeScript layer.
--
-- A reviewer is identified by either a team_member_id (authenticated) or an
-- email (guest). One vote per reviewer per variant per stage; later votes
-- from the same reviewer overwrite the earlier one.
--
-- Decisions are deleted when the item moves to a new version (mirrors the
-- behaviour of `review_item_decisions`).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS review_variant_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage text NOT NULL,
  reviewer_kind text NOT NULL CHECK (reviewer_kind IN ('member', 'guest')),
  reviewer_team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  reviewer_email text,
  reviewer_name text,
  decision text NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Either team_member or email must be set, matching reviewer_kind.
  CONSTRAINT review_variant_decisions_identity_shape CHECK (
    (reviewer_kind = 'member' AND reviewer_team_member_id IS NOT NULL)
    OR (reviewer_kind = 'guest' AND reviewer_email IS NOT NULL)
  )
);

-- Unique vote per (item, variant, stage, member).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_variant_decisions_member
  ON review_variant_decisions(item_id, variant_id, stage, reviewer_team_member_id)
  WHERE reviewer_kind = 'member';

-- Unique vote per (item, variant, stage, guest email).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_variant_decisions_guest
  ON review_variant_decisions(item_id, variant_id, stage, reviewer_email)
  WHERE reviewer_kind = 'guest';

CREATE INDEX IF NOT EXISTS idx_review_variant_decisions_item
  ON review_variant_decisions(item_id);

COMMENT ON TABLE review_variant_decisions IS
  'Per-reviewer approve/changes-requested votes on individual ad copy variants within a feedback item. Complement to review_item_decisions which tracks item-level votes.';

-- Reset variant decisions when a new version becomes active (same pattern as
-- review_item_decisions). Each version gets a fresh review cycle.
CREATE OR REPLACE FUNCTION clear_review_variant_decisions_on_version_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.active_version_id IS DISTINCT FROM OLD.active_version_id THEN
    DELETE FROM review_variant_decisions WHERE item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION clear_review_variant_decisions_on_version_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION clear_review_variant_decisions_on_version_change() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_review_variant_decisions_on_version_change() TO service_role;

DROP TRIGGER IF EXISTS trg_clear_variant_decisions_on_version_change ON review_items;
CREATE TRIGGER trg_clear_variant_decisions_on_version_change
  AFTER UPDATE OF active_version_id ON review_items
  FOR EACH ROW
  EXECUTE FUNCTION clear_review_variant_decisions_on_version_change();

COMMIT;
