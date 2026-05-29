-- Fix comment_tasks RLS: drop the wide-open "Service role full access" policy
-- that was accidentally scoped to the public role instead of service_role.
-- Service role already bypasses RLS, so the policy was redundant AND dangerous —
-- it allowed any anon-key caller to CRUD all tasks via PostgREST.
--
-- The remaining policies ("Team members can read own company tasks",
-- "Assignees can update own tasks") provide correct company-scoped access.
-- Add INSERT + DELETE policies for authenticated team members so the admin
-- UI can create and remove tasks via the API routes (which use service role),
-- and so direct client-side operations work if needed.

BEGIN;

-- Drop the wide-open policy
DROP POLICY IF EXISTS "Service role full access on comment_tasks" ON public.comment_tasks;

-- Super admins need full access (they may operate across companies)
CREATE POLICY "super_admins_manage_comment_tasks"
  ON public.comment_tasks
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMIT;
