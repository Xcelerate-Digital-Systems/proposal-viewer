'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { ArrowUpRight, Layers } from 'lucide-react';
import type { FeedbackBoardShape } from '@/lib/supabase';
import { DIAMOND_TYPES, DIAMOND_BOX_SIZE, LEGACY_DEFAULT_COLOR, type DiamondType } from './diamond-config';
import { TextShape } from './TextShape';
import { DecisionShape } from './DecisionShape';
import { WaitDiamond } from './WaitDiamond';
import { EventDiamond } from './EventDiamond';
import { DescriptionBoxShape } from './DescriptionBoxShape';
import { useFunnelBoardContext } from '@/components/admin/funnels/board/FunnelBoardContext';

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

/* ─── Diamond node frame — matches circle step node layout ──────── */

const DIAMOND_FRAME_W = 200;
const HANDLE_BASE =
  '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

function DiamondNodeHandles({ readOnly, frameH }: { readOnly?: boolean; frameH: number }) {
  const sideOutset = 20;
  const cy = DIAMOND_BOX_SIZE / 2;
  const leftX = DIAMOND_FRAME_W / 2 - DIAMOND_BOX_SIZE / 2 - sideOutset;
  const rightX = DIAMOND_FRAME_W / 2 + DIAMOND_BOX_SIZE / 2 + sideOutset;
  const topY = -sideOutset;
  const bottomY = frameH + 8;
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_BASE}
        style={{ top: topY }} isConnectable={!readOnly} />
      <Handle id="top-source" type="source" position={Position.Top} className={HANDLE_BASE}
        style={{ top: topY }} isConnectable={!readOnly} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE}
        style={{ top: cy, right: DIAMOND_FRAME_W - rightX }} isConnectable={!readOnly} />
      <Handle id="right-target" type="source" position={Position.Right} className={HANDLE_BASE}
        style={{ top: cy, right: DIAMOND_FRAME_W - rightX }} isConnectable={!readOnly} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ top: bottomY, bottom: 'auto' }} isConnectable={!readOnly} />
      <Handle id="bottom-target" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ top: bottomY, bottom: 'auto' }} isConnectable={!readOnly} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_BASE}
        style={{ top: cy, left: leftX }} isConnectable={!readOnly} />
      <Handle id="left-source" type="source" position={Position.Left} className={HANDLE_BASE}
        style={{ top: cy, left: leftX }} isConnectable={!readOnly} />
    </>
  );
}

/* ─── Constants for arrow/line primitives ────────────────────────── */

const ARROW_HEAD = 12;
const ARROW_ANGLE = Math.PI / 7;

/* ─── Main component ─────────────────────────────────────────────── */

function ShapeDescCard({ text }: { text: string }) {
  return (
    <div
      className="w-full bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.10)] border border-ink/15 px-3 py-2.5"
      style={{ marginTop: -12, paddingTop: 18, minHeight: 44 }}
    >
      <p className="text-2xs text-ink/55 leading-snug whitespace-pre-wrap line-clamp-4 text-center">{text}</p>
    </div>
  );
}

function ShapeNavPill({ label, icon, onClick }: { label: string | null; icon: 'tab' | 'funnel'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="mt-1.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal text-white text-2xs font-medium shadow-sm hover:bg-teal-hover transition-colors cursor-pointer"
      title={label ? `Go to ${label}` : icon === 'funnel' ? 'Go to linked funnel' : 'Go to linked tab'}
    >
      {icon === 'funnel' ? <ArrowUpRight size={11} strokeWidth={2.5} /> : <Layers size={11} strokeWidth={2.5} />}
      <span className="truncate max-w-[120px]">{label || (icon === 'funnel' ? 'Linked funnel' : 'Linked tab')}</span>
    </button>
  );
}

function ShapeNodeComponent({ data, selected }: NodeProps) {
  const { shape, readOnly, onUpdateContent, linkedFunnelId, linkedTabId, onNavigateTab, tabs, description } = data as import('./shape-node-types').ShapeNodeData;
  const router = useRouter();
  let ctx: ReturnType<typeof useFunnelBoardContext> | null = null;
  try { ctx = useFunnelBoardContext(); } catch { /* outside funnel context (feedback board) */ }

  const hasLinkedTab = !!linkedTabId;
  const hasLinkedFunnel = !!linkedFunnelId;
  const showNavPill = hasLinkedTab || hasLinkedFunnel;
  const linkedTabName = hasLinkedTab ? (tabs?.find((t) => t.id === linkedTabId)?.name ?? null) : null;

  const linkBadge = (linkedFunnelId || linkedTabId) ? (
    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center shadow-sm pointer-events-none z-10">
      {hasLinkedTab ? <Layers size={11} strokeWidth={2.5} /> : <ArrowUpRight size={11} strokeWidth={2.5} />}
    </div>
  ) : null;

  const navPillEl = showNavPill ? (
    <ShapeNavPill
      label={hasLinkedTab ? linkedTabName : 'Linked funnel'}
      icon={hasLinkedTab ? 'tab' : 'funnel'}
      onClick={() => {
        if (hasLinkedTab) {
          if (readOnly && onNavigateTab) onNavigateTab(linkedTabId!);
          else { ctx?.switchTab(linkedTabId!); onNavigateTab?.(linkedTabId!); }
        } else if (hasLinkedFunnel) {
          router.push(`/funnels/${linkedFunnelId}`);
        }
      }}
    />
  ) : null;

  if (shape.shape_type === 'text') {
    return (
      <div className="relative flex flex-col items-center">
        {linkBadge}
        <div className="relative z-10">
          <TextShape shape={shape} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} />
        </div>
        {navPillEl}
        {description && <ShapeDescCard text={description} />}
      </div>
    );
  }

  if (shape.shape_type === 'decision') {
    return (
      <div className="relative flex flex-col items-center">
        {linkBadge}
        <div className="relative z-10">
          <DecisionShape shape={shape} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} />
        </div>
        {navPillEl}
        {description && <ShapeDescCard text={description} />}
      </div>
    );
  }

  if (shape.shape_type === 'wait') {
    const frameH = DIAMOND_BOX_SIZE + 8 + 22 + (showNavPill ? 26 : 0) + (description ? 36 : 0);
    return (
      <>
        <DiamondNodeHandles readOnly={readOnly} frameH={frameH} />
        <div className="relative flex flex-col items-center" style={{ width: DIAMOND_FRAME_W, minHeight: frameH }}>
          {linkBadge}
          <div className="relative z-10">
            <WaitDiamond shape={shape} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} />
          </div>
          {navPillEl}
          {description && <ShapeDescCard text={description} />}
        </div>
      </>
    );
  }

  if (DIAMOND_TYPES.has(shape.shape_type)) {
    const frameH = DIAMOND_BOX_SIZE + 8 + 22 + (showNavPill ? 26 : 0) + (description ? 36 : 0);
    return (
      <>
        <DiamondNodeHandles readOnly={readOnly} frameH={frameH} />
        <div className="relative flex flex-col items-center" style={{ width: DIAMOND_FRAME_W, minHeight: frameH }}>
          {linkBadge}
          <div className="relative z-10">
            <EventDiamond shape={shape} diamondType={shape.shape_type as DiamondType} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} />
          </div>
          {navPillEl}
          {description && <ShapeDescCard text={description} />}
        </div>
      </>
    );
  }

  if (shape.shape_type === 'description_box') {
    return (
      <div className="relative flex flex-col items-center">
        {linkBadge}
        <div className="relative z-10">
          <DescriptionBoxShape shape={shape} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} />
        </div>
        {navPillEl}
        {description && <ShapeDescCard text={description} />}
      </div>
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
