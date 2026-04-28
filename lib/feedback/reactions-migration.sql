-- Emoji reactions on feedback comments. Each row is one reactor + emoji
-- pairing on a comment; toggling re-uses the same row (delete on second tap).
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/reactions-migration.sql

CREATE TABLE IF NOT EXISTS review_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_comment_id uuid NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  author_name text NOT NULL,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_comment_reactions_comment
  ON review_comment_reactions(review_comment_id);

-- Same authenticated user can't double-react with the same emoji.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_comment_reactions_user
  ON review_comment_reactions(review_comment_id, emoji, author_user_id)
  WHERE author_user_id IS NOT NULL;

-- Same guest (matched on name) can't double-react with the same emoji.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_comment_reactions_guest
  ON review_comment_reactions(review_comment_id, emoji, author_name)
  WHERE author_user_id IS NULL;
