-- Company-level kill switch for feedback comment notifications.
-- When false, no review-notify emails go out for any of this company's
-- feedback projects (team members, project owner, or guest reviewers).
-- Defaults to true so existing companies opt in without action.
--
-- Apply via Supabase SQL editor or:
--   psql "$DATABASE_URL" -f lib/feedback/feedback-email-toggle-migration.sql

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS feedback_email_notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN companies.feedback_email_notifications_enabled IS
  'Company-level kill switch for feedback comment notifications. When false, /api/review-notify short-circuits and no comment/reply emails are sent to anyone (team, owner, guests).';
