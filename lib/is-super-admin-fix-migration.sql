-- Fix is_super_admin() to be deterministic for multi-membership users.
--
-- Bug: the prior implementation SELECT is_super_admin FROM team_members
-- WHERE user_id = auth.uid() LIMIT 1 returns an arbitrary row when the
-- user has more than one membership (no ORDER BY). For platform owners
-- who hold both their own super-admin row AND a regular membership in
-- another workspace, Postgres might pick the non-super-admin row and
-- the function returns false. That cascades through every RLS policy
-- gated on is_super_admin() -- in particular the
-- super_admins_read_all_team_members policy stops firing, so useAuth's
-- "fetch all my memberships" query only sees rows for the company
-- get_user_company_id() happens to land on, and the workspace switcher
-- collapses because memberships.length == 1.
--
-- Correct semantics: super-admin is a platform-level role. A user IS a
-- super admin iff ANY of their team_members rows has is_super_admin =
-- true, regardless of which workspace they're currently looking at.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid() AND is_super_admin = true
  );
$function$;
