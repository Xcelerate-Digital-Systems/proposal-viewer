'use client';

import { memo, useMemo, useCallback, useRef } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  Position,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';

export type LabeledEdgeArrowDir = 'none' | 'source' | 'target' | 'both';
export type LabeledEdgePathType = 'bezier' | 'straight' | 'step';

export interface EdgeWaypoint { x: number; y: number }

export interface LabeledEdgeData extends Record<string, unknown> {
  label?: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  animated?: boolean;
  arrowDir?: LabeledEdgeArrowDir;
  labelFontSize?: number;
  labelColor?: string;
  edgeType?: LabeledEdgePathType;
  waypoints?: EdgeWaypoint[];
  onWaypointsChange?: (edgeId: string, waypoints: EdgeWaypoint[]) => void;
}

const ARROW_LEN = 12;
const ARROW_ANGLE = Math.PI / 7;
const LEGACY_COLORS = new Set(['#94a3b8', '#64748b', '#cbd5e1']); // remap old slate defaults to ink

function controlOffset(distance: number, curvature = 0.25): number {
  return distance === 0 ? 0 : Math.abs(distance) * curvature;
}

function bezierControlPoint(
  pos: Position, x1: number, y1: number, x2: number, y2: number,
): [number, number] {
  switch (pos) {
    case Position.Left:   return [x1 - controlOffset(x1 - x2), y1];
    case Position.Right:  return [x1 + controlOffset(x2 - x1), y1];
    case Position.Top:    return [x1, y1 - controlOffset(y1 - y2)];
    case Position.Bottom: return [x1, y1 + controlOffset(y2 - y1)];
    default: return [x1, y1];
  }
}

function bezierTangentAngle(
  pos: Position, x: number, y: number, otherX: number, otherY: number,
): number {
  const [cx, cy] = bezierControlPoint(pos, x, y, otherX, otherY);
  return Math.atan2(cy - y, cx - x);
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

function buildWaypointPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}

function WaypointHandle({
  x, y, edgeId, index, waypoints, onWaypointsChange, color,
}: {
  x: number; y: number; edgeId: string; index: number;
  waypoints: EdgeWaypoint[]; onWaypointsChange: (id: string, wps: EdgeWaypoint[]) => void;
  color: string;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const next = [...waypoints];
    next[index] = { x: pos.x, y: pos.y };
    onWaypointsChange(edgeId, next);
  }, [edgeId, index, waypoints, onWaypointsChange, screenToFlowPosition]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = waypoints.filter((_, i) => i !== index);
    onWaypointsChange(edgeId, next);
  }, [edgeId, index, waypoints, onWaypointsChange]);

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: 'all',
        zIndex: 10,
      }}
      className="nodrag nopan"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        className="w-3 h-3 rounded-full border-2 border-white cursor-grab active:cursor-grabbing shadow-sm"
        style={{ backgroundColor: color }}
        title="Drag to bend · double-click to remove"
      />
    </div>
  );
}

function MidpointHandle({
  x, y, edgeId, insertIndex, waypoints, onWaypointsChange,
}: {
  x: number; y: number; edgeId: string; insertIndex: number;
  waypoints: EdgeWaypoint[]; onWaypointsChange: (id: string, wps: EdgeWaypoint[]) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const dragging = useRef(false);
  const inserted = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    inserted.current = false;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (!inserted.current) {
      inserted.current = true;
      const next = [...waypoints];
      next.splice(insertIndex, 0, { x: pos.x, y: pos.y });
      onWaypointsChange(edgeId, next);
    } else {
      const next = [...waypoints];
      if (next[insertIndex]) {
        next[insertIndex] = { x: pos.x, y: pos.y };
        onWaypointsChange(edgeId, next);
      }
    }
  }, [edgeId, insertIndex, waypoints, onWaypointsChange, screenToFlowPosition]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    inserted.current = false;
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: 'all',
        zIndex: 8,
      }}
      className="nodrag nopan"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="w-2.5 h-2.5 rounded-full bg-ink/20 hover:bg-teal/60 cursor-grab transition-colors"
        title="Drag to add bend point"
      />
    </div>
  );
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
  const waypoints = edgeData.waypoints || [];
  const onWaypointsChange = edgeData.onWaypointsChange;
  const hasWaypoints = waypoints.length > 0;

  const SNAP_THRESHOLD = 8;
  const dy = Math.abs(targetY - sourceY);
  const dx = Math.abs(targetX - sourceX);
  const nearlyHorizontal = dy < SNAP_THRESHOLD && dx > SNAP_THRESHOLD;
  const nearlyVertical = dx < SNAP_THRESHOLD && dy > SNAP_THRESHOLD;

  const snappedSourceY = nearlyHorizontal ? (sourceY + targetY) / 2 : sourceY;
  const snappedTargetY = nearlyHorizontal ? (sourceY + targetY) / 2 : targetY;
  const snappedSourceX = nearlyVertical ? (sourceX + targetX) / 2 : sourceX;
  const snappedTargetX = nearlyVertical ? (sourceX + targetX) / 2 : targetX;

  const useStraight = !hasWaypoints && (edgeType === 'straight' || ((edgeType === 'bezier') && (nearlyHorizontal || nearlyVertical)));

  // Build path — waypoints override the normal path computation
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (hasWaypoints) {
    const allPoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
    edgePath = buildWaypointPath(allPoints);
    const mid = Math.floor(allPoints.length / 2);
    labelX = (allPoints[mid - 1].x + allPoints[mid].x) / 2;
    labelY = (allPoints[mid - 1].y + allPoints[mid].y) / 2;
  } else if (useStraight) {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX: snappedSourceX, sourceY: snappedSourceY,
      targetX: snappedTargetX, targetY: snappedTargetY,
    });
  } else if (edgeType === 'step') {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition, borderRadius: 8,
    });
  } else {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
    });
  }

  const edgeLen = Math.hypot(targetX - sourceX, targetY - sourceY);
  const bias = edgeLen < 120 ? 0.5 : 0.4;
  const biasedLabelX = hasWaypoints ? labelX : sourceX + (labelX - sourceX) * (2 * bias);
  const biasedLabelY = hasWaypoints ? labelY : sourceY + (labelY - sourceY) * (2 * bias);

  const arrowHeads = useMemo(() => {
    if (arrowDir === 'none') return '';
    const parts: string[] = [];

    if (hasWaypoints) {
      const allPts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
      if (arrowDir === 'target' || arrowDir === 'both') {
        const prev = allPts[allPts.length - 2];
        const last = allPts[allPts.length - 1];
        const angle = Math.atan2(prev.y - last.y, prev.x - last.x);
        parts.push(arrowHeadPath(last.x, last.y, angle));
      }
      if (arrowDir === 'source' || arrowDir === 'both') {
        const first = allPts[0];
        const second = allPts[1];
        const angle = Math.atan2(second.y - first.y, second.x - first.x);
        parts.push(arrowHeadPath(first.x, first.y, angle));
      }
      return parts.join(' ');
    }

    const useLineAngle = useStraight;
    const lineAngle = Math.atan2(snappedTargetY - snappedSourceY, snappedTargetX - snappedSourceX);
    if (arrowDir === 'target' || arrowDir === 'both') {
      const angle = useLineAngle
        ? lineAngle + Math.PI
        : bezierTangentAngle(targetPosition, targetX, targetY, sourceX, sourceY);
      parts.push(arrowHeadPath(useLineAngle ? snappedTargetX : targetX, useLineAngle ? snappedTargetY : targetY, angle));
    }
    if (arrowDir === 'source' || arrowDir === 'both') {
      const angle = useLineAngle
        ? lineAngle
        : bezierTangentAngle(sourcePosition, sourceX, sourceY, targetX, targetY);
      parts.push(arrowHeadPath(useLineAngle ? snappedSourceX : sourceX, useLineAngle ? snappedSourceY : sourceY, angle));
    }
    return parts.join(' ');
  }, [arrowDir, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, useStraight, hasWaypoints, waypoints, snappedSourceX, snappedSourceY, snappedTargetX, snappedTargetY]);

  // Build segment midpoints for inserting new waypoints
  const segmentMidpoints = useMemo(() => {
    if (!onWaypointsChange || !selected) return [];
    const allPts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
    const mids: { x: number; y: number; insertIndex: number }[] = [];
    for (let i = 0; i < allPts.length - 1; i++) {
      mids.push({
        x: (allPts[i].x + allPts[i + 1].x) / 2,
        y: (allPts[i].y + allPts[i + 1].y) / 2,
        insertIndex: i,
      });
    }
    return mids;
  }, [sourceX, sourceY, targetX, targetY, waypoints, onWaypointsChange, selected]);

  return (
    <>
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

      <EdgeLabelRenderer>
        {label && (
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
        )}

        {/* Waypoint drag handles — visible when selected */}
        {selected && onWaypointsChange && waypoints.map((wp, i) => (
          <WaypointHandle
            key={`wp-${i}`}
            x={wp.x} y={wp.y}
            edgeId={id} index={i}
            waypoints={waypoints}
            onWaypointsChange={onWaypointsChange}
            color={color}
          />
        ))}

        {/* Midpoint handles for inserting new waypoints */}
        {onWaypointsChange && segmentMidpoints.map((mp, i) => (
          <MidpointHandle
            key={`mid-${i}`}
            x={mp.x} y={mp.y}
            edgeId={id} insertIndex={mp.insertIndex}
            waypoints={waypoints}
            onWaypointsChange={onWaypointsChange}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  );
}

const LabeledEdge = memo(LabeledEdgeComponent);
LabeledEdge.displayName = 'LabeledEdge';

export default LabeledEdge;
