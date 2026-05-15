// lib/funnel/forecast.ts
//
// Pure forecasting helper. Walks the funnel graph from "source" nodes (steps
// with no incoming edges) and propagates visitor counts forward through each
// edge, respecting per-edge split percentages and per-step conversion rates.
//
// Inputs are manual — there is no live data. The output is what the planner
// renders on edge labels and the top-bar summary.

import type { FunnelStep, FunnelBoardEdge } from '@/lib/supabase';

export interface Forecast {
  /** Visitors arriving at each step (post-upstream propagation, pre-CVR). */
  visitorsByStep: Map<string, number>;
  /** Conversions out of each step (visitors × CVR). */
  conversionsByStep: Map<string, number>;
  /** Flow count routed along each edge. */
  flowByEdge: Map<string, number>;
  /** Total revenue summed over all steps with a per-conversion value. */
  totalRevenue: number;
  /** Total cost = sum(visitors × source.cost) + sum(conversions × step.cost).
   *  Sources typically carry CPC; offer steps may carry per-sale fulfillment. */
  totalCost: number;
  totalProfit: number;
  /** Return On Ad Spend — revenue / cost. Infinity when cost is 0. */
  roas: number;
}

export function emptyForecast(): Forecast {
  return {
    visitorsByStep: new Map(),
    conversionsByStep: new Map(),
    flowByEdge: new Map(),
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    roas: 0,
  };
}

/** Topological-ish forward pass. Cycles are tolerated (each step is visited at
 *  most once after all its predecessors have been settled — back-edges into
 *  already-settled nodes are dropped to avoid infinite recursion). */
export function computeForecast(steps: FunnelStep[], edges: FunnelBoardEdge[]): Forecast {
  const fc = emptyForecast();
  if (steps.length === 0) return fc;

  // Index edges by source for fast fan-out lookups.
  const outgoing = new Map<string, FunnelBoardEdge[]>();
  const incoming = new Map<string, FunnelBoardEdge[]>();
  for (const e of edges) {
    if (!e.source_step_id || !e.target_step_id) continue; // step-to-step only
    if (!outgoing.has(e.source_step_id)) outgoing.set(e.source_step_id, []);
    outgoing.get(e.source_step_id)!.push(e);
    if (!incoming.has(e.target_step_id)) incoming.set(e.target_step_id, []);
    incoming.get(e.target_step_id)!.push(e);
  }

  const stepById = new Map(steps.map((s) => [s.id, s]));

  // Seed: any step with manual `visitors` set OR no incoming step-edges is a
  // source. Sources start with their visitors count (default 0 if unset).
  const order: string[] = [];
  const settled = new Set<string>();
  const inDegree = new Map<string, number>();
  for (const s of steps) inDegree.set(s.id, (incoming.get(s.id) || []).length);

  // Kahn-style: start with zero-indegree nodes
  const queue: string[] = [];
  for (const s of steps) if ((inDegree.get(s.id) || 0) === 0) queue.push(s.id);

  while (queue.length) {
    const id = queue.shift()!;
    if (settled.has(id)) continue;
    settled.add(id);
    order.push(id);
    for (const e of outgoing.get(id) || []) {
      const tgt = e.target_step_id!;
      inDegree.set(tgt, (inDegree.get(tgt) || 0) - 1);
      if ((inDegree.get(tgt) || 0) <= 0) queue.push(tgt);
    }
  }
  // Append any unsettled nodes (e.g. inside a cycle) at the end so we still
  // produce some output for them.
  for (const s of steps) if (!settled.has(s.id)) order.push(s.id);

  // Forward pass
  for (const id of order) {
    const step = stepById.get(id);
    if (!step) continue;
    const manual = step.metrics?.visitors ?? null;
    const upstream = sumIncoming(id, incoming, fc.flowByEdge);
    // If user typed a visitors count, that overrides upstream — useful for
    // sources, and for cases like "assume 1000 land here" mid-funnel.
    const visitors = manual != null ? manual : upstream;
    fc.visitorsByStep.set(id, visitors);

    const cvr = clamp01(step.metrics?.conversion_rate);
    const conversions = visitors * cvr;
    fc.conversionsByStep.set(id, conversions);

    // Distribute conversions across outgoing edges by their split_percent.
    const outs = outgoing.get(id) || [];
    if (outs.length > 0) {
      const splits = normalizeSplits(outs);
      for (let i = 0; i < outs.length; i++) {
        fc.flowByEdge.set(outs[i].id, conversions * splits[i]);
      }
    }

    // Costs / revenue per step
    const value = step.metrics?.value ?? 0;
    const cost = step.metrics?.cost ?? 0;
    fc.totalRevenue += conversions * value;
    // Source-style cost: cost-per-visitor (CPC). Offer-style cost is
    // per-conversion. Heuristic: traffic_* uses per-visitor, everything else
    // uses per-conversion. The user can override by leaving the field blank.
    if (step.step_type.startsWith('traffic_')) {
      fc.totalCost += visitors * cost;
    } else {
      fc.totalCost += conversions * cost;
    }
  }

  fc.totalProfit = fc.totalRevenue - fc.totalCost;
  fc.roas = fc.totalCost > 0 ? fc.totalRevenue / fc.totalCost : (fc.totalRevenue > 0 ? Infinity : 0);
  return fc;
}

function sumIncoming(stepId: string, incoming: Map<string, FunnelBoardEdge[]>, flowByEdge: Map<string, number>): number {
  let total = 0;
  for (const e of incoming.get(stepId) || []) {
    total += flowByEdge.get(e.id) ?? 0;
  }
  return total;
}

function clamp01(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 100) return 1;
  return n / 100;
}

/** Distribute fan-out among N edges. If any edge has split_percent set, those
 *  are honoured proportionally; unset edges share the remainder evenly. If
 *  none are set, evenly split. */
function normalizeSplits(edges: FunnelBoardEdge[]): number[] {
  const set: number[] = [];
  let setSum = 0;
  let unsetCount = 0;
  for (const e of edges) {
    const v = e.split_percent;
    if (v != null && Number.isFinite(v) && v >= 0) {
      set.push(v);
      setSum += v;
    } else {
      set.push(NaN);
      unsetCount += 1;
    }
  }
  // If nothing is set, even split.
  if (setSum === 0 && unsetCount > 0) {
    return edges.map(() => 1 / edges.length);
  }
  // If only some are set, those take their share (out of 100) and the rest
  // split the remainder evenly.
  const remainder = Math.max(0, 100 - setSum);
  const perUnset = unsetCount > 0 ? remainder / unsetCount : 0;
  const raw = set.map((v) => (Number.isNaN(v) ? perUnset : v));
  // Normalise to sum=1 so totals stay coherent if user typed >100% across set edges.
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((v) => v / total);
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}
