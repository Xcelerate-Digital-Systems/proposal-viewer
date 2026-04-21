-- ============================================================================
-- Project-level widget install
-- ============================================================================
--
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Adds root_domain + script_installed_at to review_projects so the feedback
-- widget is authorised once per project (root domain) and webpage items can
-- be added without re-pasting the script for each page.
--
--   root_domain         → canonical https://host root the project lives on
--   script_installed_at → first time the widget script pinged /heartbeat
--                         for this project's share_token. Null = not yet
--                         connected; items tab shows install CTA.

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS root_domain TEXT,
  ADD COLUMN IF NOT EXISTS script_installed_at TIMESTAMPTZ;

-- Backfill: projects that already have at least one connected webpage item
-- are implicitly installed — use the earliest per-item install timestamp so
-- existing projects don't get forced into the new install wizard.
UPDATE review_projects p
SET script_installed_at = sub.first_install
FROM (
  SELECT review_project_id, MIN(widget_installed_at) AS first_install
  FROM review_items
  WHERE type = 'webpage' AND widget_installed_at IS NOT NULL
  GROUP BY review_project_id
) sub
WHERE sub.review_project_id = p.id
  AND p.script_installed_at IS NULL;
