-- Funnel Planner schema — mirrors review_board_* so we can reuse ShapeNode,
-- StickyNoteNode, and LabeledEdge from the feedback board without forking.
--
-- Funnels are presented TO prospects/clients; the audience is read-only. No
-- comments, no items, no metrics in v1 — purely a visualisation tool.

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.funnels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  share_token   text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnels_company_id_idx ON public.funnels(company_id);
CREATE INDEX IF NOT EXISTS funnels_share_token_idx ON public.funnels(share_token);

CREATE TABLE IF NOT EXISTS public.funnel_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id   uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_type   text NOT NULL,
  label       text NOT NULL DEFAULT '',
  icon        text,
  url         text,
  color       text,
  board_x     numeric NOT NULL DEFAULT 0,
  board_y     numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_steps_funnel_id_idx ON public.funnel_steps(funnel_id);

CREATE TABLE IF NOT EXISTS public.funnel_board_edges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id       uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_step_id  uuid REFERENCES public.funnel_steps(id) ON DELETE CASCADE,
  target_step_id  uuid REFERENCES public.funnel_steps(id) ON DELETE CASCADE,
  source_shape_id uuid,
  target_shape_id uuid,
  source_handle   text DEFAULT 'right',
  target_handle   text DEFAULT 'left',
  label           text,
  edge_type       text NOT NULL DEFAULT 'labeled',
  animated        boolean NOT NULL DEFAULT false,
  style           jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_board_edges_funnel_id_idx ON public.funnel_board_edges(funnel_id);

CREATE TABLE IF NOT EXISTS public.funnel_board_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id   uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  content     text NOT NULL DEFAULT '',
  color       text NOT NULL DEFAULT '#FFF4B8',
  board_x     double precision NOT NULL DEFAULT 0,
  board_y     double precision NOT NULL DEFAULT 0,
  width       double precision DEFAULT 200,
  height      double precision DEFAULT 150,
  font_size   integer DEFAULT 14,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_board_notes_funnel_id_idx ON public.funnel_board_notes(funnel_id);

CREATE TABLE IF NOT EXISTS public.funnel_board_shapes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id     uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shape_type    text NOT NULL,
  x             numeric NOT NULL,
  y             numeric NOT NULL,
  width         numeric,
  height        numeric,
  end_x         numeric,
  end_y         numeric,
  content       text,
  color         text NOT NULL DEFAULT '#2B2B2B',
  stroke_width  numeric NOT NULL DEFAULT 2,
  dashed        boolean NOT NULL DEFAULT false,
  font_size     numeric,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_board_shapes_funnel_id_idx ON public.funnel_board_shapes(funnel_id);

-- Edge FK to shapes (added after shape table exists)
ALTER TABLE public.funnel_board_edges
  DROP CONSTRAINT IF EXISTS funnel_board_edges_source_shape_id_fkey,
  DROP CONSTRAINT IF EXISTS funnel_board_edges_target_shape_id_fkey,
  ADD CONSTRAINT funnel_board_edges_source_shape_id_fkey
    FOREIGN KEY (source_shape_id) REFERENCES public.funnel_board_shapes(id) ON DELETE CASCADE,
  ADD CONSTRAINT funnel_board_edges_target_shape_id_fkey
    FOREIGN KEY (target_shape_id) REFERENCES public.funnel_board_shapes(id) ON DELETE CASCADE;

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.funnels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_steps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_board_edges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_board_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_board_shapes ENABLE ROW LEVEL SECURITY;

-- Team-member CRUD (company-scoped, super-admin override)
DROP POLICY IF EXISTS "Team members manage funnels" ON public.funnels;
CREATE POLICY "Team members manage funnels" ON public.funnels
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Team members manage funnel steps" ON public.funnel_steps;
CREATE POLICY "Team members manage funnel steps" ON public.funnel_steps
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Team members manage funnel board edges" ON public.funnel_board_edges;
CREATE POLICY "Team members manage funnel board edges" ON public.funnel_board_edges
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Team members manage funnel board notes" ON public.funnel_board_notes;
CREATE POLICY "Team members manage funnel board notes" ON public.funnel_board_notes
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Team members manage funnel board shapes" ON public.funnel_board_shapes;
CREATE POLICY "Team members manage funnel board shapes" ON public.funnel_board_shapes
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

-- Public read via share_token (so /api/funnel/[token] works via anon client
-- too, even though our public route uses the service client).
DROP POLICY IF EXISTS "Public read funnels via share token" ON public.funnels;
CREATE POLICY "Public read funnels via share token" ON public.funnels
  FOR SELECT USING (share_token IS NOT NULL);

DROP POLICY IF EXISTS "Public read funnel steps via share" ON public.funnel_steps;
CREATE POLICY "Public read funnel steps via share" ON public.funnel_steps
  FOR SELECT USING (funnel_id IN (SELECT id FROM public.funnels WHERE share_token IS NOT NULL));

DROP POLICY IF EXISTS "Public read funnel edges via share" ON public.funnel_board_edges;
CREATE POLICY "Public read funnel edges via share" ON public.funnel_board_edges
  FOR SELECT USING (funnel_id IN (SELECT id FROM public.funnels WHERE share_token IS NOT NULL));

DROP POLICY IF EXISTS "Public read funnel notes via share" ON public.funnel_board_notes;
CREATE POLICY "Public read funnel notes via share" ON public.funnel_board_notes
  FOR SELECT USING (funnel_id IN (SELECT id FROM public.funnels WHERE share_token IS NOT NULL));

DROP POLICY IF EXISTS "Public read funnel shapes via share" ON public.funnel_board_shapes;
CREATE POLICY "Public read funnel shapes via share" ON public.funnel_board_shapes
  FOR SELECT USING (funnel_id IN (SELECT id FROM public.funnels WHERE share_token IS NOT NULL));

-- ─── Public read RPC (mirrors get_whiteboard_data) ──────────────────────────

CREATE OR REPLACE FUNCTION public.get_funnel_data(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel  json;
  v_steps   json;
  v_edges   json;
  v_notes   json;
  v_shapes  json;
  v_id      uuid;
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

  SELECT COALESCE(json_agg(s ORDER BY s.created_at), '[]'::json) INTO v_steps
  FROM funnel_steps s WHERE s.funnel_id = v_id;

  SELECT COALESCE(json_agg(e), '[]'::json) INTO v_edges
  FROM funnel_board_edges e WHERE e.funnel_id = v_id;

  SELECT COALESCE(json_agg(n), '[]'::json) INTO v_notes
  FROM funnel_board_notes n WHERE n.funnel_id = v_id;

  SELECT COALESCE(json_agg(sh), '[]'::json) INTO v_shapes
  FROM funnel_board_shapes sh WHERE sh.funnel_id = v_id;

  RETURN json_build_object(
    'funnel', v_funnel,
    'steps', v_steps,
    'boardEdges', v_edges,
    'boardNotes', v_notes,
    'boardShapes', v_shapes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_data(text) TO anon, authenticated;
