-- Swipe files / types — replace the broken "USING(true) WITH CHECK(true)"
-- "authenticated_all" policies with a deny-all default. The service-role
-- client (used by every /api/ads/swipe/* route) bypasses RLS, and access
-- control is enforced in app code via lib/swipe-files/access.ts (per-folder
-- sharing model — see share-migration.sql). There are no client-side anon
-- queries to these tables, so deny-by-default is safe and matches actual
-- usage. With RLS enabled and zero policies, all non-service-role access
-- is denied.

DROP POLICY IF EXISTS "authenticated_all" ON public.swipe_files;
DROP POLICY IF EXISTS "authenticated_all" ON public.swipe_types;
