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
