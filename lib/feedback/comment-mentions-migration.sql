-- ============================================================================
-- @mentions for review comments
-- ============================================================================
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/comment-mentions-migration.sql
--
-- Adds a join table that records who was @-mentioned in each review_comment.
-- One row per (comment, mentioned identity). Identities are recorded as a
-- target_email (and where known, a team_member_id) so the notify dispatcher
-- can email mentioned users without re-parsing the comment HTML.
--
-- Comment.content is upgraded to allow TipTap HTML — existing plain-text
-- rows render unchanged because the renderer falls back to text content
-- when no markup is present.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS review_comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_comment_id uuid NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  -- Snapshot of the mentioned identity at mention time. team_member_id is
  -- nullable so we can record mentions of guests-by-email who don't have a
  -- team_members row. target_email is the canonical lookup key for routing.
  team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  target_email text NOT NULL,
  display_name text NOT NULL,
  -- 'team' = mentioned a team member; 'guest' = mentioned an invited guest
  -- recipient. Useful for the internal-stage backstop in /api/review-notify.
  target_kind text NOT NULL CHECK (target_kind IN ('team', 'guest')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One mention per (comment, target_email). Repeated @s of the same person in
-- one comment collapse to a single notification.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_comment_mentions_comment_email
  ON review_comment_mentions (review_comment_id, lower(target_email));

CREATE INDEX IF NOT EXISTS idx_review_comment_mentions_comment
  ON review_comment_mentions (review_comment_id);

CREATE INDEX IF NOT EXISTS idx_review_comment_mentions_email
  ON review_comment_mentions (lower(target_email));

-- RLS: this table mirrors review_comments visibility. Service role bypasses;
-- anon/authenticated never read directly (admin reads via service role + auth
-- checks in the API route, public reviewers via share-token API endpoints).
ALTER TABLE review_comment_mentions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON review_comment_mentions FROM PUBLIC;
REVOKE ALL ON review_comment_mentions FROM anon, authenticated;
GRANT ALL ON review_comment_mentions TO service_role;

COMMIT;
