-- ============================================================================
-- Per-reviewer approve / request-changes decisions on feedback items.
-- ============================================================================
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/item-decisions-migration.sql
--
-- The existing `review_items.status` column remains the aggregate "where is
-- this item now" pointer (drives the Kanban). This table layers Filestage's
-- per-reviewer vote tracking on top so the UI can show e.g. "2 approved · 1
-- requested changes" without losing the simple per-item status model.
--
-- A reviewer is identified by either a team_member_id (for authenticated
-- admins acting from the agency side) or an email (for guests acting through
-- a public share link). One vote per reviewer per item per stage; later
-- votes from the same reviewer overwrite the earlier one.
--
-- Decisions are deleted when the item moves to a new version — Filestage
-- treats every new version as a fresh review. The trigger below mirrors
-- that: when `active_version_id` changes on review_items, prior decisions
-- for the item are wiped.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS review_item_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_item_id uuid NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** The stage the item was in when this decision was recorded. */
  stage text NOT NULL,
  /** 'member' = team_member_id is set; 'guest' = reviewer_email is set. */
  reviewer_kind text NOT NULL CHECK (reviewer_kind IN ('member', 'guest')),
  reviewer_team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  reviewer_email text,
  reviewer_name text,
  decision text NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  decision_note text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  -- Either team_member or email must be set, matching reviewer_kind.
  CONSTRAINT review_item_decisions_identity_shape CHECK (
    (reviewer_kind = 'member' AND reviewer_team_member_id IS NOT NULL)
    OR (reviewer_kind = 'guest' AND reviewer_email IS NOT NULL)
  )
);

-- Unique vote per (item, stage, member). We treat the email as the guest
-- identity; two partial unique indexes keep the two reviewer_kinds separate
-- so we don't accidentally collide a member with a guest of the same email.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_item_decisions_member
  ON review_item_decisions(review_item_id, stage, reviewer_team_member_id)
  WHERE reviewer_kind = 'member';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_item_decisions_guest
  ON review_item_decisions(review_item_id, stage, reviewer_email)
  WHERE reviewer_kind = 'guest';

CREATE INDEX IF NOT EXISTS idx_review_item_decisions_item_stage
  ON review_item_decisions(review_item_id, stage);

COMMENT ON TABLE review_item_decisions IS
  'Per-reviewer approve/changes-requested votes on a feedback item at a specific stage. Aggregate status still lives on review_items.status; this table adds the Filestage-style "N of M approved" telemetry.';

-- Reset decisions when a new version becomes active. Filestage clears prior
-- votes on every new version — each version gets a fresh review cycle.
CREATE OR REPLACE FUNCTION clear_review_item_decisions_on_version_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.active_version_id IS DISTINCT FROM OLD.active_version_id THEN
    DELETE FROM review_item_decisions WHERE review_item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION clear_review_item_decisions_on_version_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION clear_review_item_decisions_on_version_change() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_review_item_decisions_on_version_change() TO service_role;

DROP TRIGGER IF EXISTS trg_clear_decisions_on_version_change ON review_items;
CREATE TRIGGER trg_clear_decisions_on_version_change
  AFTER UPDATE OF active_version_id ON review_items
  FOR EACH ROW
  EXECUTE FUNCTION clear_review_item_decisions_on_version_change();

COMMIT;
