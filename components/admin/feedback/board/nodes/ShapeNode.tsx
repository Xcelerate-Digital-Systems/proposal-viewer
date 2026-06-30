'use client';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { FeedbackBoardShape } from '@/lib/supabase';
import { DIAMOND_TYPES, LEGACY_DEFAULT_COLOR, type DiamondType } from './diamond-config';
import { TextShape } from './TextShape';
import { DecisionShape } from './DecisionShape';
import { WaitDiamond } from './WaitDiamond';
import { EventDiamond } from './EventDiamond';

/* ─── Re-exports (preserve public API) ───────────────────────────── */

export type { ShapeNodeData } from './shape-node-types';
export {
  parseDecisionContent,
  serializeDecisionContent,
  parseWaitContent,
  serializeWaitContent,
  parseActionContent,
  serializeActionContent,
} from './shape-parsers';

/* ─── ShapeNodeData interface ────────────────────────────────────── */
// Canonical definition moved to shape-node-types.ts; re-exported above.

/* ─── Constants for arrow/line primitives ────────────────────────── */

const ARROW_HEAD = 12;
const ARROW_ANGLE = Math.PI / 7;

/* ─── Main component ─────────────────────────────────────────────── */

function ShapeNodeComponent({ data, selected }: NodeProps) {
  const { shape, readOnly, onUpdateContent } = data as import('./shape-node-types').ShapeNodeData;

  if (shape.shape_type === 'text') {
    return (
      <TextShape
        shape={shape}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  if (shape.shape_type === 'decision') {
    return (
      <DecisionShape
        shape={shape}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  if (shape.shape_type === 'wait') {
    return (
      <WaitDiamond
        shape={shape}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  if (DIAMOND_TYPES.has(shape.shape_type)) {
    return (
      <EventDiamond
        shape={shape}
        diamondType={shape.shape_type as DiamondType}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  // Clean SVG primitives — no rough/sketchy rendering. Funnelytics-style.
  const w = shape.width ?? 0;
  const h = shape.height ?? 0;
  const endX = shape.end_x ?? 0;
  const endY = shape.end_y ?? 0;
  const color = selected ? '#017C87' : shape.color;
  const strokeWidth = shape.stroke_width + (selected ? 0.6 : 0);
  const dashArray = shape.dashed ? '8 4' : undefined;

  if (shape.shape_type === 'rectangle') {
    const pad = strokeWidth;
    const svgWidth = Math.max(w, 4) + pad * 2;
    const svgHeight = Math.max(h, 4) + pad * 2;
    return (
      <div
        style={{ position: 'relative', width: svgWidth, height: svgHeight, marginLeft: -pad, marginTop: -pad }}
        className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <rect
            x={pad}
            y={pad}
            width={w}
            height={h}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            rx={2}
            ry={2}
          />
        </svg>
      </div>
    );
  }

  if (shape.shape_type === 'ellipse') {
    const pad = strokeWidth;
    const svgWidth = Math.max(w, 4) + pad * 2;
    const svgHeight = Math.max(h, 4) + pad * 2;
    return (
      <div
        style={{ position: 'relative', width: svgWidth, height: svgHeight, marginLeft: -pad, marginTop: -pad }}
        className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <ellipse
            cx={pad + w / 2}
            cy={pad + h / 2}
            rx={w / 2}
            ry={h / 2}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
          />
        </svg>
      </div>
    );
  }

  if (shape.shape_type === 'arrow' || shape.shape_type === 'line') {
    const dx = endX;
    const dy = endY;
    const minX = Math.min(0, dx);
    const minY = Math.min(0, dy);
    const maxX = Math.max(0, dx);
    const maxY = Math.max(0, dy);
    const pad = Math.max(strokeWidth * 2, ARROW_HEAD + 4);
    const svgWidth = (maxX - minX) + pad * 2;
    const svgHeight = (maxY - minY) + pad * 2;
    const offsetX = pad - minX;
    const offsetY = pad - minY;
    const x1 = offsetX;
    const y1 = offsetY;
    const x2 = offsetX + dx;
    const y2 = offsetY + dy;

    let arrowHeadD = '';
    if (shape.shape_type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const a1 = angle + Math.PI - ARROW_ANGLE;
      const a2 = angle + Math.PI + ARROW_ANGLE;
      const p1x = x2 + Math.cos(a1) * ARROW_HEAD;
      const p1y = y2 + Math.sin(a1) * ARROW_HEAD;
      const p2x = x2 + Math.cos(a2) * ARROW_HEAD;
      const p2y = y2 + Math.sin(a2) * ARROW_HEAD;
      arrowHeadD = `M ${p1x} ${p1y} L ${x2} ${y2} L ${p2x} ${p2y}`;
    }

    const handleSize = 8;
    const onEndpointDrag = (which: 'start' | 'end') => (e: React.MouseEvent) => {
      if (readOnly) return;
      e.stopPropagation();
      e.preventDefault();
      const startMouse = { x: e.clientX, y: e.clientY };
      const origEndX = endX;
      const origEndY = endY;

      const onMove = (ev: MouseEvent) => {
        const deltaX = ev.clientX - startMouse.x;
        const deltaY = ev.clientY - startMouse.y;
        if (which === 'end') {
          onUpdateContent?.(shape.id, JSON.stringify({ __resize: true, end_x: origEndX + deltaX, end_y: origEndY + deltaY }));
        } else {
          onUpdateContent?.(shape.id, JSON.stringify({ __resize: true, end_x: origEndX - deltaX, end_y: origEndY - deltaY, move_x: deltaX, move_y: deltaY }));
        }
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    return (
      <div
        style={{
          position: 'relative',
          width: svgWidth,
          height: svgHeight,
          marginLeft: -(pad + Math.min(0, endX)),
          marginTop: -(pad + Math.min(0, endY)),
        }}
        className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeLinecap="round"
          />
          {arrowHeadD && (
            <path
              d={arrowHeadD}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {selected && !readOnly && (
            <>
              <circle
                cx={x1} cy={y1} r={handleSize / 2}
                fill="white" stroke="#017C87" strokeWidth={1.5}
                className="cursor-move"
                onMouseDown={onEndpointDrag('start')}
              />
              <circle
                cx={x2} cy={y2} r={handleSize / 2}
                fill="white" stroke="#017C87" strokeWidth={1.5}
                className="cursor-move"
                onMouseDown={onEndpointDrag('end')}
              />
            </>
          )}
        </svg>
      </div>
    );
  }

  return null;
}

const ShapeNode = memo(ShapeNodeComponent);
ShapeNode.displayName = 'ShapeNode';

export default ShapeNode;
