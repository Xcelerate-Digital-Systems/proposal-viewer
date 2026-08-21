-- Funnel legend: one per (funnel, tab) pair. Stores edge style → label mappings
-- so the board can display a viewport-pinned key explaining line styles.

create table if not exists funnel_legends (
  id          uuid primary key default gen_random_uuid(),
  funnel_id   uuid not null references funnels(id) on delete cascade,
  company_id  uuid not null,
  tab_id      uuid references funnel_tabs(id) on delete cascade,
  position    text not null default 'bottom-left',
  entries     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
);

create unique index if not exists funnel_legends_funnel_tab_uniq
  on funnel_legends (funnel_id, coalesce(tab_id, '00000000-0000-0000-0000-000000000000'));

-- RLS: service-role only (same pattern as other funnel tables).
alter table funnel_legends enable row level security;

-- No anon/authenticated policies — all access goes through service-role API routes
-- and the SECURITY DEFINER get_funnel_data RPC for public viewers.
revoke all on funnel_legends from anon, authenticated;
grant all on funnel_legends to service_role;

-- ─── Update get_funnel_data RPC to include legends ──────────────────────────

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
  v_legends   json;
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

  SELECT COALESCE(json_agg(r ORDER BY r.name), '[]'::json) INTO v_roles
  FROM funnel_roles r
  WHERE r.id IN (
    SELECT role_id FROM funnel_steps        WHERE funnel_id = v_id AND role_id IS NOT NULL
    UNION
    SELECT role_id FROM funnel_board_shapes WHERE funnel_id = v_id AND role_id IS NOT NULL
  );

  SELECT COALESCE(json_agg(lg), '[]'::json) INTO v_legends
  FROM funnel_legends lg WHERE lg.funnel_id = v_id;

  RETURN json_build_object(
    'funnel', v_funnel,
    'tabs', v_tabs,
    'steps', v_steps,
    'boardEdges', v_edges,
    'boardNotes', v_notes,
    'boardShapes', v_shapes,
    'boardSections', v_sections,
    'roles', v_roles,
    'legends', v_legends
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_data(text) TO anon, authenticated;
