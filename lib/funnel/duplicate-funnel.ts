// lib/funnel/duplicate-funnel.ts
//
// Clones an entire funnel (steps, edges, notes, shapes) into a new row with
// parent_funnel_id pointing at the original. The clone is the unit Funnelytics
// calls a "scenario" — same shape, tweakable metrics, comparable side-by-side
// against the parent.

import { supabase } from '@/lib/supabase';
import type {
  Funnel, FunnelStep, FunnelBoardEdge, FunnelBoardNote, FunnelBoardShape,
} from '@/lib/supabase';

export async function duplicateFunnelAsScenario(opts: {
  source: Funnel;
  companyId: string;
  userId: string | null;
  scenarioName?: string;
}): Promise<{ id: string; share_token: string } | null> {
  const { source, companyId, userId, scenarioName } = opts;

  // 1. Load all of the source's child rows in parallel.
  const [stepsRes, edgesRes, notesRes, shapesRes] = await Promise.all([
    supabase.from('funnel_steps').select('*').eq('funnel_id', source.id),
    supabase.from('funnel_board_edges').select('*').eq('funnel_id', source.id),
    supabase.from('funnel_board_notes').select('*').eq('funnel_id', source.id),
    supabase.from('funnel_board_shapes').select('*').eq('funnel_id', source.id),
  ]);
  const srcSteps  = (stepsRes.data  || []) as FunnelStep[];
  const srcEdges  = (edgesRes.data  || []) as FunnelBoardEdge[];
  const srcNotes  = (notesRes.data  || []) as FunnelBoardNote[];
  const srcShapes = (shapesRes.data || []) as FunnelBoardShape[];

  // 2. Create the new funnel row pointing back at the source.
  const { data: newFunnel, error: fErr } = await supabase
    .from('funnels')
    .insert({
      company_id: companyId,
      name: scenarioName || `${source.name} — Scenario`,
      description: source.description,
      currency: source.currency,
      forecast_period: source.forecast_period,
      parent_funnel_id: source.parent_funnel_id ?? source.id,
      created_by: userId,
    })
    .select().single();
  if (fErr || !newFunnel) return null;

  // 3. Steps: insert with new uuids, capture the old→new id map for edges.
  const stepRows = srcSteps.map((s) => ({
    funnel_id: newFunnel.id, company_id: companyId,
    step_type: s.step_type, label: s.label, icon: s.icon, url: s.url, color: s.color,
    board_x: s.board_x, board_y: s.board_y, metrics: s.metrics,
  }));
  const stepIdMap = new Map<string, string>();
  if (stepRows.length > 0) {
    const { data: inserted } = await supabase.from('funnel_steps').insert(stepRows).select();
    inserted?.forEach((row, i) => { stepIdMap.set(srcSteps[i].id, row.id); });
  }

  // 4. Shapes: same pattern as steps.
  const shapeRows = srcShapes.map((sh) => ({
    funnel_id: newFunnel.id, company_id: companyId,
    shape_type: sh.shape_type,
    x: sh.x, y: sh.y, width: sh.width, height: sh.height,
    end_x: sh.end_x, end_y: sh.end_y, content: sh.content,
    color: sh.color, stroke_width: sh.stroke_width, dashed: sh.dashed, font_size: sh.font_size,
  }));
  const shapeIdMap = new Map<string, string>();
  if (shapeRows.length > 0) {
    const { data: inserted } = await supabase.from('funnel_board_shapes').insert(shapeRows).select();
    inserted?.forEach((row, i) => { shapeIdMap.set(srcShapes[i].id, row.id); });
  }

  // 5. Notes: independent — just clone.
  if (srcNotes.length > 0) {
    await supabase.from('funnel_board_notes').insert(srcNotes.map((n) => ({
      funnel_id: newFunnel.id, company_id: companyId,
      content: n.content, color: n.color,
      board_x: n.board_x, board_y: n.board_y,
      width: n.width, height: n.height, font_size: n.font_size,
    })));
  }

  // 6. Edges: remap step/shape ids to the new clones.
  if (srcEdges.length > 0) {
    const edgeRows = srcEdges
      .map((e) => {
        const newSrcStep   = e.source_step_id  ? stepIdMap.get(e.source_step_id)   : null;
        const newTgtStep   = e.target_step_id  ? stepIdMap.get(e.target_step_id)   : null;
        const newSrcShape  = e.source_shape_id ? shapeIdMap.get(e.source_shape_id) : null;
        const newTgtShape  = e.target_shape_id ? shapeIdMap.get(e.target_shape_id) : null;
        // Drop edges whose endpoint we couldn't remap (shouldn't happen but
        // guards against partial clones).
        if (e.source_step_id && !newSrcStep) return null;
        if (e.target_step_id && !newTgtStep) return null;
        if (e.source_shape_id && !newSrcShape) return null;
        if (e.target_shape_id && !newTgtShape) return null;
        return {
          funnel_id: newFunnel.id, company_id: companyId,
          source_step_id: newSrcStep ?? null,
          target_step_id: newTgtStep ?? null,
          source_shape_id: newSrcShape ?? null,
          target_shape_id: newTgtShape ?? null,
          source_handle: e.source_handle, target_handle: e.target_handle,
          label: e.label, edge_type: e.edge_type, animated: e.animated,
          split_percent: e.split_percent, style: e.style,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (edgeRows.length > 0) {
      await supabase.from('funnel_board_edges').insert(edgeRows);
    }
  }

  return { id: newFunnel.id, share_token: newFunnel.share_token };
}
