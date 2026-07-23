-- Migration: per-stage due dates for review projects
-- Adds a JSONB column storing optional due dates per workflow stage.
-- Structure: { "internal_review": "2026-07-25", "client_review": "2026-07-28", ... }
-- Also adds a timestamp to track when the last automated reminder was sent,
-- preventing duplicate reminder emails from the daily cron.

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS stage_due_dates jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE review_projects
  ADD COLUMN IF NOT EXISTS last_stage_reminder_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN review_projects.stage_due_dates IS
  'Per-stage due dates as { stage_name: "YYYY-MM-DD", ... }. Empty object means no stage deadlines.';

COMMENT ON COLUMN review_projects.last_stage_reminder_at IS
  'Timestamp of the last automated stage-deadline reminder sent by the cron job. Prevents re-sending within 24h.';
