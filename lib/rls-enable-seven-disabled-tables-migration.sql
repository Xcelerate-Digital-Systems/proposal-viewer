-- Enable RLS on 7 public tables that the Supabase auditor flagged as
-- "RLS Disabled in Public" (ERROR-level).
--
-- Five are accessed only via API routes that use the service-role client
-- (which bypasses RLS), so enabling RLS with zero policies = deny-all for
-- anon/authenticated is the right outcome — service role keeps working,
-- direct PostgREST access via the anon key is blocked.
--
-- Two (review_comment_reactions, review_completions) are also queried by
-- authenticated team members directly via the anon client from the
-- /feedback/* admin pages. Those need real read policies scoped to the
-- caller's company through their parent rows.

-- ── Server-only tables: deny-all ────────────────────────────────────────
ALTER TABLE public.meta_connections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_oauth_states   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_auth_codes    ENABLE ROW LEVEL SECURITY;

-- ── review_comment_reactions ────────────────────────────────────────────
-- Authenticated team reads reactions through the anon client; the parent
-- review_comment carries company_id. Writes still go via the service-role
-- API at /api/review-comments/[id]/reactions and /api/review-widget/[token]/reactions,
-- which bypass RLS — so we only need a SELECT policy for authenticated team.
-- Anon callers (public reviewers) write via the API route, never directly.
ALTER TABLE public.review_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_select_own_company_reactions"
  ON public.review_comment_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.review_comments rc
      WHERE rc.id = review_comment_reactions.review_comment_id
        AND rc.company_id = get_user_company_id()
    )
  );

CREATE POLICY "super_admins_select_reactions"
  ON public.review_comment_reactions
  FOR SELECT
  USING (is_super_admin());

-- ── review_completions ──────────────────────────────────────────────────
-- Same pattern. Joins to review_projects for company_id.
-- Writes happen via /api/review/[token]/complete which uses service role.
ALTER TABLE public.review_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_select_own_company_completions"
  ON public.review_completions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.review_projects rp
      WHERE rp.id = review_completions.review_project_id
        AND rp.company_id = get_user_company_id()
    )
  );

CREATE POLICY "super_admins_select_completions"
  ON public.review_completions
  FOR SELECT
  USING (is_super_admin());
