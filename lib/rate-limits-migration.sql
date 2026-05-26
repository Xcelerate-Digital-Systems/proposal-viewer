-- Generic fixed-window rate limiter backed by Postgres.
--
-- Shape mirrors @upstash/ratelimit so the implementation can be swapped
-- later by editing lib/rate-limit.ts only:
--   rateLimit({ key, limit, windowSeconds }) → { success, remaining, reset }
--
-- One row per logical key (e.g. "auth:forgot:1.2.3.4" or "ai:gen:<companyId>").
-- The RPC upserts atomically: if the existing window has expired, the row is
-- reset; otherwise the count is incremented in the same statement. No race
-- between SELECT and UPDATE.
--
-- Storage growth: ~1 row per unique key ever seen. We rely on opportunistic
-- cleanup inside check_rate_limit (1% of calls delete rows >24h stale) so
-- the table stays bounded without a separate cron.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key                 TEXT        PRIMARY KEY,
  window_started_at   TIMESTAMPTZ NOT NULL,
  request_count       INTEGER     NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_started_at
  ON public.rate_limits (window_started_at);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key             TEXT,
  p_window_seconds  INTEGER,
  p_max_requests    INTEGER
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_window_started_at TIMESTAMPTZ;
  v_current_count     INTEGER;
  v_now               TIMESTAMPTZ := now();
  v_window_interval   INTERVAL    := make_interval(secs => p_window_seconds);
BEGIN
  INSERT INTO public.rate_limits (key, window_started_at, request_count, updated_at)
  VALUES (p_key, v_now, 1, v_now)
  ON CONFLICT (key) DO UPDATE
    SET window_started_at = CASE
          WHEN v_now > rate_limits.window_started_at + v_window_interval
          THEN v_now
          ELSE rate_limits.window_started_at
        END,
        request_count = CASE
          WHEN v_now > rate_limits.window_started_at + v_window_interval
          THEN 1
          ELSE rate_limits.request_count + 1
        END,
        updated_at = v_now
  RETURNING rate_limits.request_count, rate_limits.window_started_at
  INTO v_current_count, v_window_started_at;

  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
    WHERE updated_at < v_now - INTERVAL '24 hours';
  END IF;

  RETURN QUERY SELECT
    (v_current_count <= p_max_requests),
    v_current_count,
    v_window_started_at + v_window_interval;
END;
$$;

-- Supabase auto-grants EXECUTE to anon/authenticated on new public-schema
-- functions, so REVOKE FROM PUBLIC isn't enough — we have to revoke from
-- those roles explicitly.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
