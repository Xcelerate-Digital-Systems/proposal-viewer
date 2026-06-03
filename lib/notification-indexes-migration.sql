-- Add composite index on notification_log for dedup lookups.
-- The dedup query filters by (proposal_id, event_type, event_ref).
CREATE INDEX IF NOT EXISTS idx_notification_log_dedup
  ON notification_log (proposal_id, event_type, event_ref);

-- Add index on pending_review_notifications for the cron flush query
-- which filters by dispatched_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_pending_review_notifications_undispatched
  ON pending_review_notifications (dispatched_at)
  WHERE dispatched_at IS NULL;

-- Add max_attempts column to pending_review_notifications for dead-letter logic.
-- Rows that fail 5 times are skipped by the flush cron.
ALTER TABLE pending_review_notifications
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;
