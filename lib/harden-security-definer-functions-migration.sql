-- Harden SECURITY DEFINER functions flagged by the Supabase auditor.
--
-- 1. Set search_path = 'public' on all functions (addresses
--    `function_search_path_mutable` WARN — prevents a malicious schema in
--    the caller's search_path from shadowing built-ins inside the function
--    body). Using `public` (not `''`) because the function bodies reference
--    public tables unqualified; an empty search_path breaks them at runtime.
--
-- 2. Revoke EXECUTE on functions that don't need external callers:
--    * claim_next_quote_number — authenticated-only admin operation
--    * sync_page_count_on_insert / sync_page_order_on_delete — trigger
--      helpers (SECURITY DEFINER, so trigger machinery invokes them as the
--      owner without an EXECUTE check on the calling role).
--
-- Functions intentionally left exposed:
--    * get_funnel_data, get_whiteboard_data — public viewer reads via token
--    * get_user_company_id, is_super_admin — called inside RLS policies;
--      revoking would break policy evaluation for anon/authenticated
--    * set_updated_at — not SECURITY DEFINER, used by triggers; trigger
--      machinery checks EXECUTE on the calling role for non-SD functions.

ALTER FUNCTION public.claim_next_quote_number(uuid)        SET search_path = 'public';
ALTER FUNCTION public.get_funnel_data(text)                SET search_path = 'public';
ALTER FUNCTION public.get_user_company_id()                SET search_path = 'public';
ALTER FUNCTION public.get_whiteboard_data(text)            SET search_path = 'public';
ALTER FUNCTION public.is_super_admin()                     SET search_path = 'public';
ALTER FUNCTION public.set_updated_at()                     SET search_path = 'public';
ALTER FUNCTION public.sync_page_count_on_insert()          SET search_path = 'public';
ALTER FUNCTION public.sync_page_order_on_delete()          SET search_path = 'public';

-- IMPORTANT: Postgres grants EXECUTE on functions in the public schema to
-- PUBLIC by default, so a plain REVOKE FROM anon has no effect — anon still
-- inherits via PUBLIC. We have to REVOKE FROM PUBLIC and then GRANT back to
-- the roles that legitimately need it.

REVOKE EXECUTE ON FUNCTION public.claim_next_quote_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_quote_number(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.claim_next_quote_number(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_page_count_on_insert()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_page_count_on_insert()   FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.sync_page_count_on_insert()   TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_page_order_on_delete()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_page_order_on_delete()   FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.sync_page_order_on_delete()   TO service_role;
