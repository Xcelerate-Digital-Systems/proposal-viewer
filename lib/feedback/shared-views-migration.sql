-- shared-views-migration.sql
--
-- Per-project toggles controlling which tabs the public share link exposes
-- to reviewers (Board / Kanban / Items). The single project share_token now
-- drives a tabbed public viewer at /review/[token] that respects this column.
--
-- Default keeps existing behaviour: Board on (matches the current board
-- viewer at /whiteboard/[token]) + Items on (matches the current grid view).
-- Kanban is opt-in.

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS shared_views jsonb
    NOT NULL
    DEFAULT '{"board": true, "kanban": false, "items": true}'::jsonb;

-- Sanity: every existing row picks up the default automatically.
