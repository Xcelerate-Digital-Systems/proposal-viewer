'use client';

import { useReactFlow } from '@xyflow/react';
import { useMemo } from 'react';

interface Props {
  /** Active alignment lines in FLOW coordinates. The component projects them
   *  into screen space using React Flow's viewport transform. */
  horizontals: number[];
  verticals: number[];
}

/** Renders thin teal lines whenever the dragged node aligns horizontally or
 *  vertically with another node's centre. Coordinates are FLOW-space; we
 *  project to screen-space here so lines stick to nodes as the user pans/zooms. */
export default function AlignmentGuides({ horizontals, verticals }: Props) {
  const rf = useReactFlow();
  const vp = rf.getViewport();

  // Project flow Y → screen Y; flow X → screen X.
  const projectedH = useMemo(() => horizontals.map((y) => y * vp.zoom + vp.y), [horizontals, vp.y, vp.zoom]);
  const projectedV = useMemo(() => verticals.map((x) => x * vp.zoom + vp.x), [verticals, vp.x, vp.zoom]);

  if (projectedH.length === 0 && projectedV.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      style={{ overflow: 'visible' }}
    >
      {projectedH.map((y, i) => (
        <line
          key={`h-${i}`}
          x1={0} x2="100%" y1={y} y2={y}
          stroke="#017C87"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.9}
        />
      ))}
      {projectedV.map((x, i) => (
        <line
          key={`v-${i}`}
          y1={0} y2="100%" x1={x} x2={x}
          stroke="#017C87"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.9}
        />
      ))}
    </svg>
  );
}

/** Pure helper: given the node being dragged and all other nodes, return
 *  alignment lines (horizontal Ys, vertical Xs) where the dragged node's
 *  CENTRE aligns with another node's CENTRE. Tolerance is in flow units. */
export function computeAlignmentGuides(
  dragNode: { x: number; y: number; width: number; height: number },
  others: { x: number; y: number; width: number; height: number }[],
  tolerance = 6,
): { horizontals: number[]; verticals: number[]; snapDX?: number; snapDY?: number } {
  const dragCx = dragNode.x + dragNode.width / 2;
  const dragCy = dragNode.y + dragNode.height / 2;
  const horizontals: number[] = [];
  const verticals: number[] = [];
  let snapDX: number | undefined;
  let snapDY: number | undefined;
  let bestDX = Infinity;
  let bestDY = Infinity;

  for (const o of others) {
    const oCx = o.x + o.width / 2;
    const oCy = o.y + o.height / 2;
    if (Math.abs(oCy - dragCy) <= tolerance) {
      horizontals.push(oCy);
      const dy = oCy - dragCy;
      if (Math.abs(dy) < Math.abs(bestDY)) { bestDY = dy; snapDY = dy; }
    }
    if (Math.abs(oCx - dragCx) <= tolerance) {
      verticals.push(oCx);
      const dx = oCx - dragCx;
      if (Math.abs(dx) < Math.abs(bestDX)) { bestDX = dx; snapDX = dx; }
    }
  }

  // De-dupe close-together lines so we don't render multiple at the same Y/X.
  const dedupe = (arr: number[]) => Array.from(new Set(arr.map((n) => Math.round(n))));
  return { horizontals: dedupe(horizontals), verticals: dedupe(verticals), snapDX, snapDY };
}
