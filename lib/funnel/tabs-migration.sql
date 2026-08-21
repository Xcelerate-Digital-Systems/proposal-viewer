-- Funnel Tabs — lets one funnel contain multiple named canvases (tabs) that
-- share a single funnel row / share_token. Cross-tab links switch the active
-- tab instead of navigating to another funnel entirely.

-- ─── New table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.funnel_tabs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id   uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Untitled',
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_tabs_funnel_id_idx ON public.funnel_tabs(funnel_id);

-- ─── tab_id on all four board-content tables ───────────────────────────────
-- Nullable — NULL means "implicit single canvas" for funnels without tabs.

ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS tab_id uuid REFERENCES public.funnel_tabs(id) ON DELETE CASCADE;
ALTER TABLE public.funnel_board_edges
  ADD COLUMN IF NOT EXISTS tab_id uuid REFERENCES public.funnel_tabs(id) ON DELETE CASCADE;
ALTER TABLE public.funnel_board_shapes
  ADD COLUMN IF NOT EXISTS tab_id uuid REFERENCES public.funnel_tabs(id) ON DELETE CASCADE;
ALTER TABLE public.funnel_board_notes
  ADD COLUMN IF NOT EXISTS tab_id uuid REFERENCES public.funnel_tabs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS funnel_steps_tab_id_idx        ON public.funnel_steps(tab_id);
CREATE INDEX IF NOT EXISTS funnel_board_edges_tab_id_idx  ON public.funnel_board_edges(tab_id);
CREATE INDEX IF NOT EXISTS funnel_board_shapes_tab_id_idx ON public.funnel_board_shapes(tab_id);
CREATE INDEX IF NOT EXISTS funnel_board_notes_tab_id_idx  ON public.funnel_board_notes(tab_id);

-- ─── Cross-tab link columns ───────────────────────────────────────────────

ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS linked_tab_id uuid
  REFERENCES public.funnel_tabs(id) ON DELETE SET NULL;

ALTER TABLE public.funnel_board_shapes
  ADD COLUMN IF NOT EXISTS linked_tab_id uuid
  REFERENCES public.funnel_tabs(id) ON DELETE SET NULL;

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.funnel_tabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members manage funnel tabs" ON public.funnel_tabs;
CREATE POLICY "Team members manage funnel tabs" ON public.funnel_tabs
  FOR ALL USING (
    company_id IN (SELECT tm.company_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR is_super_admin()
  );

-- No public/anon read policy here — the public viewer reads tabs through the
-- SECURITY DEFINER get_funnel_data(p_token) RPC below, never via the anon
-- client. A `share_token IS NOT NULL` predicate matches every row in the
-- table and would expose every tenant's tab names to anon.
DROP POLICY IF EXISTS "Public read funnel tabs via share" ON public.funnel_tabs;

-- ─── Update get_funnel_data to include tabs ────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_funnel_data(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_funnel  json;
  v_tabs    json;
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

  RETURN json_build_object(
    'funnel', v_funnel,
    'tabs', v_tabs,
    'steps', v_steps,
    'boardEdges', v_edges,
    'boardNotes', v_notes,
    'boardShapes', v_shapes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_data(text) TO anon, authenticated;
