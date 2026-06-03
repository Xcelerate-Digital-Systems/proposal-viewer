-- Purge stale rows from high-write notification/tracking tables.
-- Called by the existing cron job or a new one on a daily schedule.
CREATE OR REPLACE FUNCTION public.purge_stale_notifications(p_days_old int DEFAULT 30)
RETURNS TABLE(table_name text, rows_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cutoff timestamptz := now() - (p_days_old || ' days')::interval;
  cnt bigint;
BEGIN
  -- notification_log: proposal notification dedup entries
  DELETE FROM notification_log WHERE created_at < cutoff;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  table_name := 'notification_log'; rows_deleted := cnt; RETURN NEXT;

  -- proposal_views: view tracking entries
  DELETE FROM proposal_views WHERE created_at < cutoff;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  table_name := 'proposal_views'; rows_deleted := cnt; RETURN NEXT;

  -- rate_limits: expired sliding-window entries
  DELETE FROM rate_limits WHERE window_start < cutoff;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  table_name := 'rate_limits'; rows_deleted := cnt; RETURN NEXT;

  -- pending_review_notifications: dispatched rows older than 7 days,
  -- plus undispatched rows older than p_days_old (dead letters).
  DELETE FROM pending_review_notifications
   WHERE (dispatched_at IS NOT NULL AND dispatched_at < now() - interval '7 days')
      OR (dispatched_at IS NULL AND created_at < cutoff);
  GET DIAGNOSTICS cnt = ROW_COUNT;
  table_name := 'pending_review_notifications'; rows_deleted := cnt; RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_stale_notifications(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_stale_notifications(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_stale_notifications(int) TO service_role;
