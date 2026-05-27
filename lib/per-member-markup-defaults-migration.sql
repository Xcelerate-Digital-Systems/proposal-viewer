-- Migration: add per-member markup notification defaults to team_members
-- These override the company-level defaults when seeding new project assignee rows.
-- NULL = inherit from company default; true/false = member-specific override.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS markup_notify_comment     boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS markup_notify_reply       boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS markup_notify_resolve     boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS markup_notify_status      boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS markup_notify_new_version boolean DEFAULT NULL;

COMMENT ON COLUMN team_members.markup_notify_comment     IS 'Per-member markup default: new comments. NULL = use company default.';
COMMENT ON COLUMN team_members.markup_notify_reply       IS 'Per-member markup default: replies. NULL = use company default.';
COMMENT ON COLUMN team_members.markup_notify_resolve     IS 'Per-member markup default: resolved. NULL = use company default.';
COMMENT ON COLUMN team_members.markup_notify_status      IS 'Per-member markup default: status changes. NULL = use company default.';
COMMENT ON COLUMN team_members.markup_notify_new_version IS 'Per-member markup default: new versions. NULL = use company default.';
