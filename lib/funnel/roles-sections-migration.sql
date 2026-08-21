-- Funnel roles + board sections.
--
-- ROLES are deliberately NOT tied to team_members or auth users. A role is a
-- plain coloured label — "Sales Rep", "Account Manager", "Me" — so a funnel can
-- show who owns which step without anyone being invited to the account. They're
-- company-scoped rather than funnel-scoped so a role typed once is reusable
-- across every funnel and pipeline.
--
-- SECTIONS are labelled background regions ("Lead Generation", "Onboarding")
-- drawn behind the nodes. Membership is positional — a node is in a section
-- when it sits inside its bounds — so there is no join table and no node-side
-- FK to keep in sync.

-- ─── Roles ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.funnel_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#017C87',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funnel_roles_company_id_idx ON public.funnel_roles(company_id);

-- One role per name per company, case-insensitively, so "Sales Rep" and
-- "sales rep" don't both end up in the picker.
CREATE UNIQUE INDEX IF NOT EXISTS funnel_roles_company_name_key
  ON public.funnel_roles(company_id, lower(name));

-- Clearing a role must not delete the node it was assigned to.
ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.funnel_roles(id) ON DELETE SET NULL;
ALTER TABLE public.funnel_board_shapes
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.funnel_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS funnel_steps_role_id_idx        ON public.funnel_steps(role_id);
CREATE INDEX IF NOT EXISTS funnel_board_shapes_role_id_idx ON public.funnel_board_shapes(role_id);

ALTER TABLE public.funnel_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members manage funnel roles" ON public.funnel_roles;
CREATE POLICY "Team members manage funnel roles" ON public.funnel_roles
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

-- No public/anon policy: the viewer reads roles through get_funnel_data below,
-- which is SECURITY DEFINER and scoped to one share_token.

-- ─── Sections ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.funnel_board_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id   uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tab_id      uuid REFERENCES public.funnel_tabs(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Section',
  color       text NOT NULL DEFAULT 'teal',
  x           double precision NOT NULL DEFAULT 0,
  y           double precision NOT NULL DEFAULT 0,
  width       double precision NOT NULL DEFAULT 400,
  height      double precision NOT NULL DEFAULT 300,
  locked      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_board_sections ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS funnel_board_sections_funnel_id_idx ON public.funnel_board_sections(funnel_id);
CREATE INDEX IF NOT EXISTS funnel_board_sections_tab_id_idx    ON public.funnel_board_sections(tab_id);

ALTER TABLE public.funnel_board_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members manage funnel sections" ON public.funnel_board_sections;
CREATE POLICY "Team members manage funnel sections" ON public.funnel_board_sections
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

-- ─── get_funnel_data: add sections + the roles this funnel actually uses ───

CREATE OR REPLACE FUNCTION public.get_funnel_data(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_funnel    json;
  v_tabs      json;
  v_steps     json;
  v_edges     json;
  v_notes     json;
  v_shapes    json;
  v_sections  json;
  v_roles     json;
  v_id        uuid;
BEGIN
  SELECT row_to_json(f) INTO v_funnel
  FROM (
    SELECT * FROM funnels
    WHERE share_token = p_token
      AND status != 'archived'
    LIMIT 1
  ) f;

  IF v_funnel IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  v_id := (v_funnel->>'id')::uuid;

  SELECT COALESCE(json_agg(t ORDER BY t.position, t.created_at), '[]'::json) INTO v_tabs
  FROM funnel_tabs t WHERE t.funnel_id = v_id;

  SELECT COALESCE(json_agg(s ORDER BY s.created_at), '[]'::json) INTO v_steps
  FROM funnel_steps s WHERE s.funnel_id = v_id;

  SELECT COALESCE(json_agg(e), '[]'::json) INTO v_edges
  FROM funnel_board_edges e WHERE e.funnel_id = v_id;

  SELECT COALESCE(json_agg(n), '[]'::json) INTO v_notes
  FROM funnel_board_notes n WHERE n.funnel_id = v_id;

  SELECT COALESCE(json_agg(sh), '[]'::json) INTO v_shapes
  FROM funnel_board_shapes sh WHERE sh.funnel_id = v_id;

  SELECT COALESCE(json_agg(sec ORDER BY sec.created_at), '[]'::json) INTO v_sections
  FROM funnel_board_sections sec WHERE sec.funnel_id = v_id;

  -- Only the roles referenced by this funnel's nodes — never the company's
  -- whole role library, which would leak role names across a share link.
  SELECT COALESCE(json_agg(r ORDER BY r.name), '[]'::json) INTO v_roles
  FROM funnel_roles r
  WHERE r.id IN (
    SELECT role_id FROM funnel_steps        WHERE funnel_id = v_id AND role_id IS NOT NULL
    UNION
    SELECT role_id FROM funnel_board_shapes WHERE funnel_id = v_id AND role_id IS NOT NULL
  );

  RETURN json_build_object(
    'funnel', v_funnel,
    'tabs', v_tabs,
    'steps', v_steps,
    'boardEdges', v_edges,
    'boardNotes', v_notes,
    'boardShapes', v_shapes,
    'boardSections', v_sections,
    'roles', v_roles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_data(text) TO anon, authenticated;

-- ─── Platform badge ────────────────────────────────────────────────────────
--
-- Which system a node runs in — a brand slug from BRAND_SLUGS_SET ('ghl',
-- 'servicem8', 'hubspot', ...). Rendered as a small logo badge on the node,
-- distinct from `icon`, which is the node's own mark. A pipeline stage keeps
-- its "Qualified" tick while showing that it lives in GoHighLevel.
--
-- Deliberately a plain text slug rather than an FK: the brand catalogue lives
-- in code (public/icons/brands + BRAND_SLUGS_SET), not in a table, and an
-- unrecognised slug degrades to no badge rather than breaking the node.

ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.funnel_board_shapes
  ADD COLUMN IF NOT EXISTS platform text;
