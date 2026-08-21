// lib/funnel/forecast.ts
//
// Pure forecasting helper. Walks the funnel graph from "source" nodes (steps
// with no incoming edges) and propagates visitor counts forward through each
// edge, respecting per-edge split percentages and per-step conversion rates.
//
// Inputs are manual — there is no live data. The output is what the planner
// renders on edge labels and the top-bar summary.

import type {
  FunnelStep, FunnelBoardEdge, FunnelBoardShape, FunnelForecastPeriod, FunnelCurrency,
} from '@/lib/supabase';
import { FUNNEL_PERIODS, FUNNEL_CURRENCIES } from '@/lib/types/funnel';

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

/** Topological-ish forward pass over the whole board graph.
 *
 *  The graph is NOT step-only. Shapes (decision diamonds, waits, actions,
 *  events, …) are first-class nodes that pass flow straight through at 100%,
 *  so `Ad → Landing Page → [Decision] → Booking` propagates correctly instead
 *  of dropping to zero the moment a shape sits mid-chain. Shapes carry no
 *  metrics of their own — they route, they don't convert. A shape that fans
 *  out to several edges still honours each edge's `split_percent`.
 *
 *  Sticky notes are annotations, not flow: an edge whose endpoint resolves to
 *  neither a step nor a shape is dropped from the graph.
 *
 *  Cycles are tolerated (each node is visited at most once after all its
 *  predecessors have been settled — back-edges into already-settled nodes are
 *  dropped to avoid infinite recursion).
 *
 *  When `period` is provided, source visitor counts (and downstream flow) are
 *  multiplied by the period's multiplier — e.g. yearly multiplies visitors by
 *  12 so the totals reflect 12 months of running the funnel.
 *
 *  Subscription / membership / SaaS / trial offers honour `metrics.recurring_months`
 *  to model LTV: a conversion at value=$49 with recurring_months=6 contributes
 *  $294 of revenue, not $49. */
export function computeForecast(
  steps: FunnelStep[],
  edges: FunnelBoardEdge[],
  period: FunnelForecastPeriod = 'total',
  defaultDealValue: number | null = null,
  shapes: FunnelBoardShape[] = [],
): Forecast {
  const fc = emptyForecast();
  if (steps.length === 0) return fc;

  // Unified node keyspace so steps and shapes share one graph. Step and shape
  // ids come from different tables, so they're prefixed to stay unambiguous.
  const stepKey = (id: string) => `s:${id}`;
  const shapeKey = (id: string) => `h:${id}`;

  const stepById = new Map(steps.map((s) => [stepKey(s.id), s]));
  const shapeIds = new Set(shapes.map((sh) => shapeKey(sh.id)));
  const nodeKeys: string[] = [
    ...steps.map((s) => stepKey(s.id)),
    ...shapes.map((sh) => shapeKey(sh.id)),
  ];
  const isNode = (k: string | null) => k != null && (stepById.has(k) || shapeIds.has(k));

  /** Resolve an edge endpoint to a graph node key, or null when it points at
   *  something that isn't part of the flow (e.g. a sticky note). */
  const endpoint = (stepId: string | null, shapeId: string | null): string | null => {
    if (stepId) { const k = stepKey(stepId); return stepById.has(k) ? k : null; }
    if (shapeId) { const k = shapeKey(shapeId); return shapeIds.has(k) ? k : null; }
    return null;
  };

  // Index edges by source for fast fan-out lookups.
  const outgoing = new Map<string, FunnelBoardEdge[]>();
  const incoming = new Map<string, FunnelBoardEdge[]>();
  const edgeEnds = new Map<string, { from: string; to: string }>();
  for (const e of edges) {
    const from = endpoint(e.source_step_id, e.source_shape_id);
    const to = endpoint(e.target_step_id, e.target_shape_id);
    if (!isNode(from) || !isNode(to)) continue;
    edgeEnds.set(e.id, { from: from!, to: to! });
    if (!outgoing.has(from!)) outgoing.set(from!, []);
    outgoing.get(from!)!.push(e);
    if (!incoming.has(to!)) incoming.set(to!, []);
    incoming.get(to!)!.push(e);
  }

  // Kahn-style topological order over the unified node set.
  const order: string[] = [];
  const settled = new Set<string>();
  const inDegree = new Map<string, number>();
  for (const k of nodeKeys) inDegree.set(k, (incoming.get(k) || []).length);

  const queue: string[] = [];
  for (const k of nodeKeys) if ((inDegree.get(k) || 0) === 0) queue.push(k);

  while (queue.length) {
    const k = queue.shift()!;
    if (settled.has(k)) continue;
    settled.add(k);
    order.push(k);
    for (const e of outgoing.get(k) || []) {
      const tgt = edgeEnds.get(e.id)!.to;
      inDegree.set(tgt, (inDegree.get(tgt) || 0) - 1);
      if ((inDegree.get(tgt) || 0) <= 0) queue.push(tgt);
    }
  }
  // Append any unsettled nodes (e.g. inside a cycle) at the end so we still
  // produce some output for them.
  for (const k of nodeKeys) if (!settled.has(k)) order.push(k);

  const periodMultiplier = FUNNEL_PERIODS.find((p) => p.code === period)?.multiplier ?? 1;
  const RECURRING_OFFER_TYPES = new Set(['offer_subscription', 'offer_saas', 'offer_trial']);

  // Forward pass
  for (const key of order) {
    const step = stepById.get(key);
    const upstream = sumIncoming(key, incoming, fc.flowByEdge);

    // Shapes are pure routers: whatever arrives leaves, no CVR, no money.
    if (!step) {
      distribute(key, upstream, outgoing, edgeEnds, fc.flowByEdge);
      continue;
    }

    const manual = step.metrics?.visitors ?? null;
    // If user typed a visitors count, that overrides upstream — useful for
    // sources, and for cases like "assume 1000 land here" mid-funnel.
    // Apply the period multiplier to source-supplied visitor counts only;
    // downstream nodes inherit it through the upstream flow.
    const visitors = manual != null ? manual * periodMultiplier : upstream;
    fc.visitorsByStep.set(step.id, visitors);

    const cvr = clamp01(step.metrics?.conversion_rate);
    const conversions = visitors * cvr;
    fc.conversionsByStep.set(step.id, conversions);

    distribute(key, conversions, outgoing, edgeEnds, fc.flowByEdge);

    // Costs / revenue per step. Recurring offer types multiply value by the
    // user-supplied recurring_months (defaults to 1) so subscription LTV is
    // captured without separate plumbing.
    //
    // `default_deal_value` is a funnel-wide *deal* value, so it only backfills
    // offer steps. Applying it to every node would book the same revenue once
    // per step in the chain and inflate revenue/profit/ROAS by the chain length.
    const isOffer = step.step_type.startsWith('offer_');
    const value = step.metrics?.value ?? (isOffer ? defaultDealValue ?? 0 : 0);
    const cost = step.metrics?.cost ?? 0;
    const ltvMultiplier = RECURRING_OFFER_TYPES.has(step.step_type)
      ? Math.max(1, step.metrics?.recurring_months ?? 1)
      : 1;
    fc.totalRevenue += conversions * value * ltvMultiplier;
    // Source-style cost: cost-per-click (CPC). Offer-style cost is
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

/** Route `amount` out of a node across its outgoing edges, honouring each
 *  edge's split_percent. */
function distribute(
  nodeKey: string,
  amount: number,
  outgoing: Map<string, FunnelBoardEdge[]>,
  edgeEnds: Map<string, { from: string; to: string }>,
  flowByEdge: Map<string, number>,
) {
  const outs = outgoing.get(nodeKey) || [];
  if (outs.length === 0) return;
  const splits = normalizeSplits(outs);
  for (let i = 0; i < outs.length; i++) {
    flowByEdge.set(outs[i].id, amount * splits[i]);
  }
}

function sumIncoming(nodeKey: string, incoming: Map<string, FunnelBoardEdge[]>, flowByEdge: Map<string, number>): number {
  let total = 0;
  for (const e of incoming.get(nodeKey) || []) {
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

/** Distribute fan-out among N edges.
 *
 *  An explicit split_percent is taken literally: an edge marked 30% carries 30%
 *  of the upstream flow, full stop. That matters because drop-off is the normal
 *  case in a funnel — "30% of people who land here book a call" has to be
 *  expressible, and the other 70% simply leave rather than going somewhere else.
 *  Rescaling explicit percentages up to fill 100% (which this used to do) turned
 *  every lone labelled edge into a pass-through.
 *
 *  Edges left unset share whatever percentage the explicit ones didn't claim.
 *  If nothing is set at all, flow splits evenly, which keeps the common
 *  "just draw the branches" case sensible.
 *
 *  The only rescaling left is the overflow guard: if explicit values add up to
 *  more than 100% they're scaled back down to 100%, so a typo can't manufacture
 *  more traffic than arrived. */
function normalizeSplits(edges: FunnelBoardEdge[]): number[] {
  const explicit: number[] = [];
  let explicitSum = 0;
  let unsetCount = 0;

  for (const e of edges) {
    const v = e.split_percent;
    if (v != null && Number.isFinite(v) && v >= 0) {
      explicit.push(v);
      explicitSum += v;
    } else {
      explicit.push(NaN);
      unsetCount += 1;
    }
  }

  // Nothing specified — even split across the branches.
  if (unsetCount === edges.length) {
    return edges.map(() => 1 / edges.length);
  }

  // Overflow guard only: scale explicit values down if they exceed 100%.
  const scale = explicitSum > 100 ? 100 / explicitSum : 1;
  const remainder = Math.max(0, 100 - explicitSum * scale);
  const perUnset = unsetCount > 0 ? remainder / unsetCount : 0;

  return explicit.map((v) => (Number.isNaN(v) ? perUnset : v * scale) / 100);
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export function formatMoney(n: number, currency: FunnelCurrency = 'USD'): string {
  if (!Number.isFinite(n)) return '—';
  const symbol = FUNNEL_CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${symbol}${Math.round(abs).toLocaleString()}`;
}
