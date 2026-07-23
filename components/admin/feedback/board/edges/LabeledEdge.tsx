'use client';

import { memo, useMemo } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from '@xyflow/react';

export type LabeledEdgeArrowDir = 'none' | 'source' | 'target' | 'both';
export type LabeledEdgePathType = 'bezier' | 'straight' | 'step';

export interface LabeledEdgeData extends Record<string, unknown> {
  label?: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  animated?: boolean;
  /** Which end(s) of the edge draw an arrowhead. Defaults to 'target'. */
  arrowDir?: LabeledEdgeArrowDir;
  /** Label font size in px. Defaults to 16. */
  labelFontSize?: number;
  /** Label text color (hex). Defaults to ink. */
  labelColor?: string;
  /** Edge path type. Defaults to 'bezier'. */
  edgeType?: LabeledEdgePathType;
}

const ARROW_LEN = 12;
const ARROW_ANGLE = Math.PI / 7;
const LEGACY_COLORS = new Set(['#94a3b8', '#64748b', '#cbd5e1']); // remap old slate defaults to ink

function arrowAngleFor(position: Position): number {
  switch (position) {
    case Position.Left: return Math.PI;
    case Position.Right: return 0;
    case Position.Top: return -Math.PI / 2;
    case Position.Bottom: return Math.PI / 2;
    default: return Math.PI;
  }
}

function arrowHeadPath(x: number, y: number, angleRad: number): string {
  const a1 = angleRad + ARROW_ANGLE;
  const a2 = angleRad - ARROW_ANGLE;
  const p1x = x + Math.cos(a1) * ARROW_LEN;
  const p1y = y + Math.sin(a1) * ARROW_LEN;
  const p2x = x + Math.cos(a2) * ARROW_LEN;
  const p2y = y + Math.sin(a2) * ARROW_LEN;
  return `M ${p1x} ${p1y} L ${x} ${y} L ${p2x} ${p2y}`;
}

function LabeledEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}: EdgeProps) {
  const edgeData = (data || {}) as LabeledEdgeData;
  const label = edgeData.label;
  const rawColor = edgeData.color || (style as Record<string, string>).stroke || '#2B2B2B';
  const color = selected
    ? '#017C87'
    : LEGACY_COLORS.has(rawColor.toLowerCase())
      ? '#2B2B2B'
      : rawColor;
  const strokeWidth =
    (edgeData.strokeWidth || Number((style as Record<string, number>).strokeWidth) || 2) +
    (selected ? 0.6 : 0);
  const dashed = edgeData.dashed || false;
  const animated = edgeData.animated || false;
  const arrowDir: LabeledEdgeArrowDir = edgeData.arrowDir ?? 'target';
  const edgeType: LabeledEdgePathType = edgeData.edgeType ?? 'bezier';

  // Snap threshold: if source and target are within 20px on one axis, treat as
  // perfectly aligned for bezier paths (renders a straight line automatically).
  const SNAP_THRESHOLD = 20;
  const dy = Math.abs(targetY - sourceY);
  const dx = Math.abs(targetX - sourceX);
  const nearlyHorizontal = dy < SNAP_THRESHOLD && dx > SNAP_THRESHOLD;
  const nearlyVertical = dx < SNAP_THRESHOLD && dy > SNAP_THRESHOLD;

  // Compute snapped coordinates for near-straight connections
  const snappedSourceY = nearlyHorizontal ? (sourceY + targetY) / 2 : sourceY;
  const snappedTargetY = nearlyHorizontal ? (sourceY + targetY) / 2 : targetY;
  const snappedSourceX = nearlyVertical ? (sourceX + targetX) / 2 : sourceX;
  const snappedTargetX = nearlyVertical ? (sourceX + targetX) / 2 : targetX;

  const useStraight = edgeType === 'straight' || ((edgeType === 'bezier') && (nearlyHorizontal || nearlyVertical));

  const [edgePath, labelX, labelY] = useStraight
    ? getStraightPath({
        sourceX: snappedSourceX,
        sourceY: snappedSourceY,
        targetX: snappedTargetX,
        targetY: snappedTargetY,
      })
    : edgeType === 'step'
      ? getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 8,
        })
      : getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        });

  // Bias label toward the source so it doesn't sit under the arrowhead.
  // For short edges (<120px), use 0.5 (centre) to avoid overlap.
  const edgeLen = Math.hypot(targetX - sourceX, targetY - sourceY);
  const bias = edgeLen < 120 ? 0.5 : 0.4;
  const biasedLabelX = sourceX + (labelX - sourceX) * (2 * bias);
  const biasedLabelY = sourceY + (labelY - sourceY) * (2 * bias);

  const arrowHeads = useMemo(() => {
    if (arrowDir === 'none') return '';
    const parts: string[] = [];
    // For straight/snapped edges, compute arrow angle from actual line direction
    // instead of handle position (which may not reflect the snapped path).
    const useLineAngle = useStraight;
    const lineAngle = Math.atan2(snappedTargetY - snappedSourceY, snappedTargetX - snappedSourceX);
    if (arrowDir === 'target' || arrowDir === 'both') {
      const angle = useLineAngle ? lineAngle + Math.PI : arrowAngleFor(targetPosition);
      parts.push(arrowHeadPath(useLineAngle ? snappedTargetX : targetX, useLineAngle ? snappedTargetY : targetY, angle));
    }
    if (arrowDir === 'source' || arrowDir === 'both') {
      const angle = useLineAngle ? lineAngle : arrowAngleFor(sourcePosition);
      parts.push(arrowHeadPath(useLineAngle ? snappedSourceX : sourceX, useLineAngle ? snappedSourceY : sourceY, angle));
    }
    return parts.join(' ');
  }, [arrowDir, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, useStraight, snappedSourceX, snappedSourceY, snappedTargetX, snappedTargetY]);

  // Click events bubble to React Flow's onEdgeClick handler.

  return (
    <>
      {/* Invisible wider hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        style={{ cursor: 'pointer' }}
      />

      <g style={{ cursor: 'pointer' }}>
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={animated ? '10 6' : dashed ? '8 4' : undefined}
          style={animated ? { animation: 'sketch-dashflow 0.6s linear infinite' } : undefined}
        />
        {arrowHeads && (
          <path
            d={arrowHeads}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${biasedLabelX}px,${biasedLabelY}px)`,
              pointerEvents: 'all',
              zIndex: 5,
              cursor: 'pointer',
            }}
            className="nodrag nopan"
          >
            <div
              className={`px-2.5 py-1 rounded-lg leading-tight border cursor-pointer transition-colors shadow-[0_2px_6px_rgba(20,20,40,0.12)] ${
                selected
                  ? 'bg-teal/10 border-teal'
                  : 'bg-white border-edge hover:border-ink/30'
              }`}
              style={{
                fontSize: edgeData.labelFontSize ?? 14,
                color: selected ? '#017C87' : (edgeData.labelColor ?? '#2B2B2B'),
                backgroundColor: selected ? undefined : '#ffffff',
              }}
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
