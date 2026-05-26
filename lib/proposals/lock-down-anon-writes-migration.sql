-- Proposals: lock down anon writes.
--
-- The existing "Public can update proposal status via share token" policy was
-- USING(true) WITH CHECK(true) — i.e. any anon caller could UPDATE any column
-- of any proposal in the database. The new model:
--
--   * All public-viewer mutations (accept / decline / request_revision /
--     view-tracking) route through POST /api/proposals/[token]/action, which
--     uses the service-role client and authenticates by share_token in the URL.
--   * Anon role no longer has UPDATE or INSERT on proposals. SELECT remains
--     so the public viewer can still read by share_token via the anon client
--     (the "Public can read proposals via share token" policy still uses
--     USING(true), which is overpermissive but separate from this change).
--   * Authenticated team members and super-admins are unaffected — their
--     own policies handle company-scoped reads/writes.

DROP POLICY IF EXISTS "Public can update proposal status via share token" ON public.proposals;

REVOKE INSERT, UPDATE ON public.proposals FROM anon;
