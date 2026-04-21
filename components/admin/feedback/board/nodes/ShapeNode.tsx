'use client';

import { memo, useMemo, useState, useEffect, useRef } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { FeedbackBoardShape } from '@/lib/supabase';
import { roughRect, roughLine, roughPath } from '@/components/feedback/sketchy/roughPath';
import { hashStringToInt } from '@/components/feedback/sketchy/seed';

const ARROW_HEAD = 14;
const ARROW_ANGLE = Math.PI / 6;

export interface ShapeNodeData extends Record<string, unknown> {
  shape: FeedbackBoardShape;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}

function ShapeNodeComponent({ data, selected }: NodeProps) {
  const { shape, readOnly, onUpdateContent } = data as ShapeNodeData;
  const seed = useMemo(() => hashStringToInt(shape.id), [shape.id]);

  // Text shape uses a simple editable div instead of rough rendering
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

  // Compute SVG dimensions based on shape type
  const w = shape.width ?? 0;
  const h = shape.height ?? 0;
  const endX = shape.end_x ?? 0;
  const endY = shape.end_y ?? 0;

  let svgWidth: number;
  let svgHeight: number;
  let paths: { d: string; stroke: string; strokeWidth: number; fill?: string }[] = [];

  const color = selected ? '#017C87' : shape.color;
  const strokeWidth = shape.stroke_width + (selected ? 0.6 : 0);
  const baseOpts = {
    seed,
    roughness: 1.8,
    bowing: 1.5,
    stroke: color,
    strokeWidth,
    strokeLineDash: shape.dashed ? [8, 4] : undefined,
    disableMultiStroke: false,
  };

  if (shape.shape_type === 'rectangle') {
    svgWidth = Math.max(w, 4) + strokeWidth * 4;
    svgHeight = Math.max(h, 4) + strokeWidth * 4;
    const pad = strokeWidth * 2;
    paths = roughRect(pad, pad, w, h, baseOpts);
  } else if (shape.shape_type === 'ellipse') {
    svgWidth = Math.max(w, 4) + strokeWidth * 4;
    svgHeight = Math.max(h, 4) + strokeWidth * 4;
    const pad = strokeWidth * 2;
    // Use ellipse path: rough.js generator has ellipse
    paths = roughPath(
      `M ${pad + w / 2} ${pad} a ${w / 2} ${h / 2} 0 1 0 0 ${h} a ${w / 2} ${h / 2} 0 1 0 0 -${h}`,
      baseOpts
    );
  } else if (shape.shape_type === 'arrow' || shape.shape_type === 'line') {
    // For arrow/line: dx, dy = end relative to start (shape node is anchored at start = 0,0 locally)
    const dx = endX;
    const dy = endY;
    const minX = Math.min(0, dx);
    const minY = Math.min(0, dy);
    const maxX = Math.max(0, dx);
    const maxY = Math.max(0, dy);
    const pad = Math.max(strokeWidth * 2, ARROW_HEAD + 4);
    svgWidth = (maxX - minX) + pad * 2;
    svgHeight = (maxY - minY) + pad * 2;
    const offsetX = pad - minX;
    const offsetY = pad - minY;
    const x1 = offsetX;
    const y1 = offsetY;
    const x2 = offsetX + dx;
    const y2 = offsetY + dy;

    paths = roughLine(x1, y1, x2, y2, { ...baseOpts, disableMultiStroke: true });

    if (shape.shape_type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const a1 = angle + Math.PI - ARROW_ANGLE;
      const a2 = angle + Math.PI + ARROW_ANGLE;
      const arrowOpts = { ...baseOpts, seed: seed + 1, roughness: 1.1, bowing: 0.6, strokeLineDash: undefined };
      const arm1 = roughLine(x2, y2, x2 + Math.cos(a1) * ARROW_HEAD, y2 + Math.sin(a1) * ARROW_HEAD, arrowOpts);
      const arm2 = roughLine(x2, y2, x2 + Math.cos(a2) * ARROW_HEAD, y2 + Math.sin(a2) * ARROW_HEAD, arrowOpts);
      paths = [...paths, ...arm1, ...arm2];
    }
  } else {
    return null;
  }

  // Shape node visually anchors at shape's stored (x, y). We offset svg inside so the visual start is flush.
  const style: React.CSSProperties =
    shape.shape_type === 'arrow' || shape.shape_type === 'line'
      ? {
          position: 'relative',
          width: svgWidth,
          height: svgHeight,
          // negative margin so the svg padding doesn't push the anchor off
          marginLeft: -(Math.max(shape.stroke_width * 2, ARROW_HEAD + 4) + Math.min(0, endX)),
          marginTop: -(Math.max(shape.stroke_width * 2, ARROW_HEAD + 4) + Math.min(0, endY)),
        }
      : {
          position: 'relative',
          width: svgWidth,
          height: svgHeight,
          marginLeft: -strokeWidth * 2,
          marginTop: -strokeWidth * 2,
        };

  return (
    <div style={style} className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}>
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill={p.fill ?? 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}

function TextShape({
  shape, selected, readOnly, onUpdateContent,
}: {
  shape: FeedbackBoardShape;
  selected: boolean;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(!shape.content); // auto-edit fresh text
  const [draft, setDraft] = useState(shape.content ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = shape.font_size ?? 16;

  useEffect(() => {
    setDraft(shape.content ?? '');
  }, [shape.content]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (shape.content ?? '').trim()) {
      onUpdateContent?.(shape.id, draft.trim());
    }
  };

  if (editing && !readOnly) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(shape.content ?? '');
            setEditing(false);
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="Type something…"
        className="bg-transparent border-none outline-none resize-none min-w-[80px] min-h-[28px] font-hand text-sketch-ink"
        style={{ fontSize, lineHeight: 1.3, color: shape.color }}
      />
    );
  }

  return (
    <div
      onDoubleClick={() => !readOnly && setEditing(true)}
      className={`font-hand whitespace-pre-wrap cursor-text px-1 ${selected ? 'ring-2 ring-teal/30' : ''}`}
      style={{ fontSize, lineHeight: 1.3, color: shape.color }}
    >
      {shape.content || (!readOnly && <span className="opacity-40">Double-click to edit</span>)}
    </div>
  );
}

const ShapeNode = memo(ShapeNodeComponent);
ShapeNode.displayName = 'ShapeNode';

export default ShapeNode;
