'use client';

import { memo, useMemo } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  type EdgeProps,
} from '@xyflow/react';
import { roughPath, roughLine } from '@/components/feedback/sketchy/roughPath';
import { hashStringToInt } from '@/components/feedback/sketchy/seed';

export type LabeledEdgeArrowDir = 'none' | 'source' | 'target' | 'both';

export interface LabeledEdgeData extends Record<string, unknown> {
  label?: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  animated?: boolean;
  /** Which end(s) of the edge draw an arrowhead. Defaults to 'target'. */
  arrowDir?: LabeledEdgeArrowDir;
  onEdgeClick?: (edgeId: string) => void;
}

const ARROW_LEN = 18;
const ARROW_ANGLE = Math.PI / 6; // ~30deg
const LEGACY_COLORS = new Set(['#94a3b8', '#64748b', '#cbd5e1']); // remap old slate defaults to sketch-ink

// `position` is the target handle's side. The arrow tip points INTO the target,
// so the tail extends AWAY from the target — opposite the entry direction.
function arrowAngleFor(position: Position): number {
  switch (position) {
    case Position.Left: return Math.PI;          // tip points right; tail extends left
    case Position.Right: return 0;               // tip points left; tail extends right
    case Position.Top: return -Math.PI / 2;      // tip points down; tail extends up
    case Position.Bottom: return Math.PI / 2;    // tip points up; tail extends down
    default: return Math.PI;
  }
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
    (edgeData.strokeWidth || Number((style as Record<string, number>).strokeWidth) || 2.2) +
    (selected ? 0.6 : 0);
  const dashed = edgeData.dashed || false;
  const animated = edgeData.animated || false;
  const arrowDir: LabeledEdgeArrowDir = edgeData.arrowDir ?? 'target';
  const seed = hashStringToInt(id);

  // Snap to 2px grid to avoid regen on sub-pixel pan
  const sx = Math.round(sourceX / 2) * 2;
  const sy = Math.round(sourceY / 2) * 2;
  const tx = Math.round(targetX / 2) * 2;
  const ty = Math.round(targetY / 2) * 2;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition,
    targetX: tx,
    targetY: ty,
    targetPosition,
  });

  const shaftPaths = useMemo(() => {
    // For animated edges, we render a single clean rough stroke and let
    // CSS dashoffset animate; multi-stroke jitter would fight the animation.
    return roughPath(edgePath, {
      seed,
      roughness: 2.2,
      bowing: 2.6,
      stroke: color,
      strokeWidth,
      strokeLineDash: dashed && !animated ? [10, 5] : undefined,
      disableMultiStroke: animated,
    });
  }, [edgePath, seed, color, strokeWidth, dashed, animated]);

  const arrowPaths = useMemo(() => {
    if (arrowDir === 'none') return [];
    const arrowOpts = {
      seed: seed + 1,
      roughness: 1.1,
      bowing: 0.6,
      stroke: color,
      strokeWidth: strokeWidth + 0.3,
      disableMultiStroke: false,
    };

    const heads: { d: string; stroke: string; strokeWidth: number }[] = [];
    const drawHead = (x: number, y: number, angleRad: number, seedOffset: number) => {
      const a1 = angleRad + ARROW_ANGLE;
      const a2 = angleRad - ARROW_ANGLE;
      const opts = { ...arrowOpts, seed: seed + seedOffset };
      heads.push(...roughLine(x, y, x + Math.cos(a1) * ARROW_LEN, y + Math.sin(a1) * ARROW_LEN, opts));
      heads.push(...roughLine(x, y, x + Math.cos(a2) * ARROW_LEN, y + Math.sin(a2) * ARROW_LEN, opts));
    };

    // Target arrow: tail extends AWAY from the target (opposite of where the
    // edge enters). Source arrow: tail extends AWAY from the source.
    if (arrowDir === 'target' || arrowDir === 'both') {
      drawHead(tx, ty, arrowAngleFor(targetPosition), 1);
    }
    if (arrowDir === 'source' || arrowDir === 'both') {
      drawHead(sx, sy, arrowAngleFor(sourcePosition), 2);
    }
    return heads;
  }, [arrowDir, seed, color, strokeWidth, sourcePosition, targetPosition, sx, sy, tx, ty]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    edgeData.onEdgeClick?.(id);
  };

  return (
    <>
      {/* Invisible wider hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
      />

      {/* Sketchy shaft */}
      <g style={{ cursor: 'pointer' }} onClick={handleClick}>
        {shaftPaths.map((p, i) => (
          <path
            key={`shaft-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={animated ? '10 6' : undefined}
            style={animated ? { animation: 'sketch-dashflow 0.6s linear infinite' } : undefined}
          />
        ))}
        {/* Arrowhead — always solid, never animated */}
        {arrowPaths.map((p, i) => (
          <path
            key={`arrow-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

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
              className={`px-2.5 py-1 rounded-md font-hand text-base leading-tight border-2 shadow-sketch cursor-pointer transition-colors ${
                selected
                  ? 'bg-teal/10 border-teal text-teal'
                  : 'bg-paper border-sketch-ink/70 text-sketch-ink hover:border-sketch-ink'
              }`}
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
