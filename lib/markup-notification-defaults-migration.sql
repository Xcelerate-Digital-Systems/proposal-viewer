-- lib/markup-notification-defaults-migration.sql
--
-- Agency-level default notification preferences for the markup tool.
--
-- The five toggles already exist per-row on `review_project_assignees` and on
-- `review_project_guest_recipients` (notify_comment / notify_reply /
-- notify_resolve / notify_status / notify_new_version). Until now, the only
-- "default" for a fresh row was the boolean DEFAULT on each project-row
-- column, with no way for an admin to change it.
--
-- These columns let an owner/admin set agency-wide defaults that are read
-- when a new assignee is added or when a guest recipient row is auto-created
-- for the first time. Once the project-level row exists it is the source of
-- truth — these defaults are NOT applied retroactively.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS markup_notify_comment      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS markup_notify_reply        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS markup_notify_resolve      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS markup_notify_status       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS markup_notify_new_version  boolean NOT NULL DEFAULT true;
