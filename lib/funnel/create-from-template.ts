// lib/funnel/create-from-template.ts
//
// Spins up a funnel + steps + edges from a static template in one batch.
// Used by the new-funnel modal when the user picks a starter template.

import { supabase } from '@/lib/supabase';
import { FUNNEL_STEP_DEFAULTS } from '@/lib/types/funnel';
import { templatePositionForIndex, type FunnelTemplate } from './templates';

export async function createFunnelFromTemplate(opts: {
  template: FunnelTemplate;
  companyId: string;
  userId: string | null;
  name?: string;
}): Promise<{ id: string; share_token: string } | null> {
  const { template, companyId, userId, name } = opts;

  // 1. Create the funnel shell.
  const { data: funnel, error: fErr } = await supabase
    .from('funnels')
    .insert({
      company_id: companyId,
      name: name || template.name,
      description: template.description,
      created_by: userId,
    })
    .select().single();
  if (fErr || !funnel) return null;

  // 2. Insert steps. Capture the returned uuids so we can wire edges next.
  const stepRows = template.steps.map((s, i) => {
    const defaults = FUNNEL_STEP_DEFAULTS[s.step_type] ?? FUNNEL_STEP_DEFAULTS.generic;
    const pos = templatePositionForIndex(i);
    return {
      funnel_id: funnel.id,
      company_id: companyId,
      step_type: s.step_type,
      label: s.label || defaults.label,
      icon: s.icon || defaults.icon,
      color: s.color || null,
      url: null,
      board_x: pos.board_x,
      board_y: pos.board_y,
      metrics: s.metrics || {},
    };
  });
  const { data: insertedSteps, error: sErr } = await supabase
    .from('funnel_steps').insert(stepRows).select();
  if (sErr || !insertedSteps) return { id: funnel.id, share_token: funnel.share_token };

  // Map template `key` → DB uuid.
  const idByKey = new Map<string, string>();
  template.steps.forEach((seed, i) => { idByKey.set(seed.key, insertedSteps[i].id); });

  // 3. Insert edges using the resolved uuids.
  const edgeRows = template.edges
    .map((e) => {
      const src = idByKey.get(e.from);
      const tgt = idByKey.get(e.to);
      if (!src || !tgt) return null;
      return {
        funnel_id: funnel.id,
        company_id: companyId,
        source_step_id: src,
        target_step_id: tgt,
        source_shape_id: null,
        target_shape_id: null,
        source_handle: 'right',
        target_handle: 'left',
        label: e.label || null,
        edge_type: 'labeled',
        animated: !!e.animated,
        split_percent: e.split_percent ?? null,
        style: { stroke: '#2B2B2B', strokeWidth: 2 },
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (edgeRows.length > 0) {
    await supabase.from('funnel_board_edges').insert(edgeRows);
  }

  return { id: funnel.id, share_token: funnel.share_token };
}
