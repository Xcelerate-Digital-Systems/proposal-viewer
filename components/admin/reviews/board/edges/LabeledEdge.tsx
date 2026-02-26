// components/admin/reviews/board/edges/LabeledEdge.tsx
'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

/* ─── Edge data interface ──────────────────────────────────────── */

export interface LabeledEdgeData extends Record<string, unknown> {
  label?: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  animated?: boolean;
  onEdgeClick?: (edgeId: string) => void;
}

/* ─── Component ────────────────────────────────────────────────── */

function LabeledEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const edgeData = (data || {}) as LabeledEdgeData;
  const label = edgeData.label;
  const color = edgeData.color || (style as Record<string, string>).stroke || '#94a3b8';
  const strokeWidth = edgeData.strokeWidth || Number((style as Record<string, number>).strokeWidth) || 2;
  const dashed = edgeData.dashed || false;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    edgeData.onEdgeClick?.(id);
  };

  return (
    <>
      {/* Invisible wider hit area for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
      />

      {/* Visible edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#017C87' : color,
          strokeWidth: selected ? strokeWidth + 0.5 : strokeWidth,
          strokeDasharray: dashed ? '6 3' : undefined,
          cursor: 'pointer',
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />

      {/* Label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
            onClick={handleClick}
          >
            <div
              className={`
                px-2.5 py-1 rounded-md text-[11px] font-medium leading-tight
                border shadow-sm cursor-pointer transition-all
                ${selected
                  ? 'bg-[#017C87]/10 border-[#017C87]/30 text-[#017C87]'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-600'
                }
              `}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const LabeledEdge = memo(LabeledEdgeComponent);
LabeledEdge.displayName = 'LabeledEdge';

export default LabeledEdge;