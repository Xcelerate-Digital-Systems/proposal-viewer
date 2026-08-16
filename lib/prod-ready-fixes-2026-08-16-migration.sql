-- Production readiness fixes — 2026-08-16
-- Applied live to lyiwnbezmtbwpipbmgqp; this file records the changes for reproducibility.

-- C-1: Enable RLS on review_variant_decisions (PII: reviewer_email, reviewer_name)
ALTER TABLE public.review_variant_decisions ENABLE ROW LEVEL SECURITY;

-- H-1: Revoke purge_stale_email_log from anon/authenticated/public (unauthenticated delete)
REVOKE EXECUTE ON FUNCTION public.purge_stale_email_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_stale_email_log() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_stale_email_log() TO service_role;

-- H-2: Revoke claim_next_quote_number from authenticated/public (cross-tenant manipulation)
REVOKE EXECUTE ON FUNCTION public.claim_next_quote_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_quote_number(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_quote_number(uuid) TO service_role;
