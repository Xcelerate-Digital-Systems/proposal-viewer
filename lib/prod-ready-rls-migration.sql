-- prod-ready-rls-migration.sql
--
-- Fixes two classes of RLS issue:
--
--   C1) Funnel tables have always-true public SELECT policies. The condition
--        `share_token IS NOT NULL` is tautologically true because share_token
--        has a NOT NULL DEFAULT. This means every row in every funnel table is
--        readable by anon/authenticated regardless of whether the caller knows
--        the share token. Drop these policies; the service-role API route at
--        /api/funnel/[token] uses get_funnel_data() (SECURITY DEFINER) which
--        bypasses RLS, so public viewers are unaffected.
--
--   C2) Three tables (api_keys, oauth_extension_codes, review_item_decisions)
--        have RLS disabled entirely, meaning anon/authenticated can read and
--        write them directly via PostgREST. Enable RLS with zero policies to
--        get deny-all for non-service-role callers.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- C1: Drop always-true public SELECT policies on funnel tables
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public read funnels via share token"    ON public.funnels;
DROP POLICY IF EXISTS "Public read funnel steps via share"     ON public.funnel_steps;
DROP POLICY IF EXISTS "Public read funnel edges via share"     ON public.funnel_board_edges;
DROP POLICY IF EXISTS "Public read funnel notes via share"     ON public.funnel_board_notes;
DROP POLICY IF EXISTS "Public read funnel shapes via share"    ON public.funnel_board_shapes;

-- The team-member CRUD policies remain in place ("Team members manage …").
-- Public reads go through get_funnel_data(token) which is SECURITY DEFINER
-- and already validates the share_token parameter, so no replacement SELECT
-- policy is needed.

-- ═══════════════════════════════════════════════════════════════════════════
-- C2: Enable RLS on tables that were missing it
-- ═══════════════════════════════════════════════════════════════════════════

-- api_keys — accessed exclusively via service-role API routes.
-- No policies = deny-all for anon/authenticated; service_role bypasses RLS.
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- oauth_extension_codes — accessed exclusively via service-role API routes.
ALTER TABLE public.oauth_extension_codes ENABLE ROW LEVEL SECURITY;

-- review_item_decisions — accessed exclusively via service-role API routes.
ALTER TABLE public.review_item_decisions ENABLE ROW LEVEL SECURITY;

COMMIT;
