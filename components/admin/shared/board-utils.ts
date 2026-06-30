import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';

export const ALIGNMENT_TOLERANCE = 6;

export function genericVisualCentre(n: Node): { cx: number; cy: number } {
  const m = (n as unknown as { measured?: { width?: number; height?: number } }).measured;
  const w = m?.width ?? (n as { width?: number }).width ?? 100;
  const h = m?.height ?? (n as { height?: number }).height ?? 100;
  return { cx: n.position.x + w / 2, cy: n.position.y + h / 2 };
}

type CentreFn = (n: Node) => { cx: number; cy: number };

export function computeSnapPosition(
  node: Node,
  allNodes: Node[],
  tolerance: number,
  centreFn: CentreFn = genericVisualCentre,
): { x: number; y: number } | null {
  const others = allNodes.filter((n) => n.id !== node.id);
  const drag = centreFn(node);
  let snapX: number | null = null;
  let snapY: number | null = null;
  let bestDX = Infinity;
  let bestDY = Infinity;

  for (const o of others) {
    const oc = centreFn(o);
    const dy = Math.abs(oc.cy - drag.cy);
    const dx = Math.abs(oc.cx - drag.cx);
    if (dy <= tolerance && dy < bestDY) {
      bestDY = dy;
      snapY = node.position.y + (oc.cy - drag.cy);
    }
    if (dx <= tolerance && dx < bestDX) {
      bestDX = dx;
      snapX = node.position.x + (oc.cx - drag.cx);
    }
  }

  if (snapX === null && snapY === null) return null;
  return {
    x: snapX !== null ? Math.round(snapX) : node.position.x,
    y: snapY !== null ? Math.round(snapY) : node.position.y,
  };
}

export function alignNodesCentre(
  selected: Node[],
  axis: 'horizontal' | 'vertical',
  centreFn: CentreFn = genericVisualCentre,
): Map<string, { x: number; y: number }> {
  if (selected.length < 2) return new Map();
  const items = selected.map((n) => ({ id: n.id, pos: n.position, c: centreFn(n) }));
  const avg = axis === 'horizontal'
    ? items.reduce((sum, c) => sum + c.c.cy, 0) / items.length
    : items.reduce((sum, c) => sum + c.c.cx, 0) / items.length;
  const result = new Map<string, { x: number; y: number }>();
  for (const c of items) {
    if (axis === 'horizontal') {
      result.set(c.id, { x: c.pos.x, y: Math.round(c.pos.y + (avg - c.c.cy)) });
    } else {
      result.set(c.id, { x: Math.round(c.pos.x + (avg - c.c.cx)), y: c.pos.y });
    }
  }
  return result;
}

export function distributeNodes(
  selected: Node[],
  axis: 'horizontal' | 'vertical',
  centreFn: CentreFn = genericVisualCentre,
): Map<string, { x: number; y: number }> {
  if (selected.length < 3) return new Map();
  const items = selected.map((n) => ({ id: n.id, pos: n.position, c: centreFn(n) }));
  items.sort((a, b) => axis === 'horizontal' ? a.c.cx - b.c.cx : a.c.cy - b.c.cy);

  const first = items[0];
  const last = items[items.length - 1];
  const span = axis === 'horizontal' ? last.c.cx - first.c.cx : last.c.cy - first.c.cy;
  const step = span / (items.length - 1);

  const result = new Map<string, { x: number; y: number }>();
  for (let i = 1; i < items.length - 1; i++) {
    const target = axis === 'horizontal'
      ? first.c.cx + step * i
      : first.c.cy + step * i;
    const item = items[i];
    if (axis === 'horizontal') {
      result.set(item.id, { x: Math.round(item.pos.x + (target - item.c.cx)), y: item.pos.y });
    } else {
      result.set(item.id, { x: item.pos.x, y: Math.round(item.pos.y + (target - item.c.cy)) });
    }
  }
  return result;
}

export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'LR',
): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120 });

  for (const node of nodes) {
    const m = (node as unknown as { measured?: { width?: number; height?: number } }).measured;
    g.setNode(node.id, { width: m?.width ?? 200, height: m?.height ?? 120 });
  }
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  Dagre.layout(g);

  const result = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const laid = g.node(node.id);
    if (!laid) continue;
    result.set(node.id, {
      x: Math.round(laid.x - (laid.width || 200) / 2),
      y: Math.round(laid.y - (laid.height || 120) / 2),
    });
  }
  return result;
}
