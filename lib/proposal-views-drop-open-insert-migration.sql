-- View-tracking inserts now route through POST /api/proposals/[token]/action
-- (service role), so anon no longer needs INSERT on proposal_views. The
-- previous policy was WITH CHECK (true) which let any anon/authenticated
-- forge view records for any company.
--
-- After this migration:
--   * Anon: no policy → cannot insert (service role still can, bypasses RLS)
--   * Authenticated: only the "Company members can read views" SELECT policy
--     remains; no INSERT/UPDATE for normal users.

DROP POLICY IF EXISTS "Public can insert views" ON public.proposal_views;
REVOKE INSERT ON public.proposal_views FROM anon, authenticated;
