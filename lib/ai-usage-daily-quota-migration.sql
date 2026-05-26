-- Per-company daily AI usage tracking for /api/ai/generate-text.
--
-- One row per company per UTC day. The route increments
-- request_count atomically before each Anthropic call and rejects with
-- 429 once the day's count exceeds the cap. Server-side enforcement
-- prevents a compromised account or runaway frontend from spiking the
-- Anthropic bill.
--
-- Only the service role touches this table — RLS is enabled with zero
-- policies = deny-all for anon/authenticated (matches our pattern for
-- internal-only tables like meta_oauth_states).

CREATE TABLE IF NOT EXISTS public.ai_usage (
  company_id    UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  usage_date    DATE    NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, usage_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Atomic increment helper. Returns the *new* request_count after the
-- increment, so the route can compare against the quota in a single
-- round-trip and avoid a race between SELECT and UPDATE.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage (company_id, request_count)
  VALUES (p_company_id, 1)
  ON CONFLICT (company_id, usage_date)
  DO UPDATE SET
    request_count = ai_usage.request_count + 1,
    updated_at    = now()
  RETURNING request_count INTO v_count;
  RETURN v_count;
END;
$$;

-- Only service role should call this (the API route does). PUBLIC is
-- denied so a random anon/authenticated PostgREST RPC call can't
-- artificially inflate someone else's quota.
-- Supabase auto-grants EXECUTE to anon/authenticated on new public-schema
-- functions, so REVOKE FROM PUBLIC isn't enough — revoke from those roles
-- explicitly.
REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_ai_usage(UUID) TO service_role;
