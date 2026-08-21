'use client';

import { memo, useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { ArrowUpRight, Layers, Mail, MessageSquare } from 'lucide-react';
import {
  messageKindForShape, parseNodeMessage, hasMessageContent,
} from '@/lib/types/funnel';
import RoleChip from '@/components/admin/funnels/board/nodes/RoleChip';
import PlatformBadge from '@/components/admin/funnels/board/nodes/PlatformBadge';
import type { FeedbackBoardShape } from '@/lib/supabase';
import { DIAMOND_TYPES, DIAMOND_BOX_SIZE, DIAMOND_CONFIG, DIAMOND_LABEL_GAP, DIAMOND_LABEL_BELOW, LEGACY_DEFAULT_COLOR, type DiamondType } from './diamond-config';
import { parseActionContent, parseWaitContent, formatWaitLabel } from './shape-parsers';
import { TextShape } from './TextShape';
import { DecisionShape } from './DecisionShape';
import { WaitDiamond } from './WaitDiamond';
import { EventDiamond } from './EventDiamond';
import { DescriptionBoxShape } from './DescriptionBoxShape';
import { useFunnelBoardContext } from '@/components/admin/funnels/board/FunnelBoardContext';

// Funnel-only surface — lazy so the feedback whiteboard never loads the chunk.
const NodeMessageModal = lazy(() => import('@/components/admin/funnels/board/NodeMessageModal'));

/** Modal title per message-capable shape type. */
const SHAPE_MESSAGE_TITLES: Record<string, string> = {
  email_notification: 'Email Notification',
  sms_notification: 'SMS Notification',
};

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

function DiamondNodeHandles({ readOnly }: { readOnly?: boolean; frameH?: number }) {
  const sideOutset = 20;
  const cy = DIAMOND_BOX_SIZE / 2;
  const leftX = DIAMOND_FRAME_W / 2 - DIAMOND_BOX_SIZE / 2 - sideOutset;
  const rightX = DIAMOND_FRAME_W / 2 + DIAMOND_BOX_SIZE / 2 + sideOutset;
  const topY = -sideOutset;
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
        style={{ bottom: -8, top: 'auto' }} isConnectable={!readOnly} />
      <Handle id="bottom-target" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ bottom: -8, top: 'auto' }} isConnectable={!readOnly} />
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
  const { shape, readOnly, onUpdateContent, linkedFunnelId, linkedTabId, onNavigateTab, tabs, description, message, role: roleFromData } = data as import('./shape-node-types').ShapeNodeData;
  const router = useRouter();
  const [messageOpen, setMessageOpen] = useState(false);

  let ctx: ReturnType<typeof useFunnelBoardContext> | null = null;
  try { ctx = useFunnelBoardContext(); } catch { /* outside funnel context (feedback board) */ }

  // Funnel-only owner chip and platform badge. On the feedback whiteboard
  // there's no funnel context and the columns don't exist, so both resolve to
  // null and nothing renders.
  const shapeRoleId = (shape as unknown as { role_id?: string | null }).role_id ?? null;
  const role = roleFromData ?? ctx?.roles.find((r) => r.id === shapeRoleId) ?? null;
  const shapePlatform = (shape as unknown as { platform?: string | null }).platform ?? null;

  const hasLinkedTab = !!linkedTabId;
  const hasLinkedFunnel = !!linkedFunnelId;
  const showNavPill = hasLinkedTab || hasLinkedFunnel;
  const linkedTabName = hasLinkedTab ? (tabs?.find((t) => t.id === linkedTabId)?.name ?? null) : null;

  // Corner markers for rectangular shapes (text, description box): the link
  // badge owns the top-right, the role chip the top-left, and both overhang the
  // shape's edge. Diamonds use `diamondCorners` below instead — their bounding
  // box is much wider than the shape, so these would float clear of it.
  const linkBadge = (linkedFunnelId || linkedTabId || role) ? (
    <>
      {(linkedFunnelId || linkedTabId) && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center shadow-sm pointer-events-none z-10">
          {hasLinkedTab ? <Layers size={11} strokeWidth={2.5} /> : <ArrowUpRight size={11} strokeWidth={2.5} />}
        </div>
      )}
      {role && <RoleChip role={role} compact />}
    </>
  ) : null;

  const isDiamondShape = shape.shape_type === 'decision'
    || shape.shape_type === 'wait'
    || DIAMOND_TYPES.has(shape.shape_type);

  const platformBadgeEl = shapePlatform
    ? <PlatformBadge slug={shapePlatform} size={28} offset={-4} />
    : null;

  /* Corner markers for diamonds.
   *
   *  Diamonds can't use the frame-level markers the other shapes do. The frame
   *  is DIAMOND_FRAME_W (200px) wide while the diamond itself is only
   *  DIAMOND_BOX_SIZE (88px) and centred in it, so a frame-anchored badge lands
   *  ~56px clear of the shape. The label also lives *inside* the diamond
   *  component, so anchoring to that wrapper's bottom put the badge beside the
   *  text instead of on the shape.
   *
   *  So: an explicit 88x88 overlay pinned to the top-centre of the wrapper —
   *  exactly where the diamond box sits, whatever the label does — and the
   *  markers positioned against its edges.
   *
   *  Offsets are inset rather than overhanging because a diamond's bounding-box
   *  corners are empty: the edge runs diagonally through them, so the visual
   *  edge midpoints are at roughly (66,22) top-right and (66,66) bottom-right. */
  const diamondCorners = (linkedFunnelId || linkedTabId || role || shapePlatform) ? (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        top: 0, left: '50%', transform: 'translateX(-50%)',
        width: DIAMOND_BOX_SIZE, height: DIAMOND_BOX_SIZE,
      }}
    >
      {(linkedFunnelId || linkedTabId) && (
        <div
          className="absolute w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center shadow-sm"
          style={{ top: 10, right: 10 }}
        >
          {hasLinkedTab ? <Layers size={11} strokeWidth={2.5} /> : <ArrowUpRight size={11} strokeWidth={2.5} />}
        </div>
      )}
      {role && (
        <div className="absolute" style={{ top: 6, left: 6 }}>
          <RoleChip role={role} compact />
        </div>
      )}
      {shapePlatform && <PlatformBadge slug={shapePlatform} size={28} offset={8} />}
    </div>
  ) : null;

  // Email/SMS attached to this node (funnel board only). The preview modal is
  // rendered from this same slot: it portals to document.body, so its position
  // in the tree is irrelevant and every shape branch picks it up by rendering
  // `navPillEl`, which they all already do.
  const messageKind = messageKindForShape(shape.shape_type);
  const parsedMessage = messageKind ? parseNodeMessage(message) : null;
  const showMessagePill = !!parsedMessage && hasMessageContent(parsedMessage);

  const navPillEl = (showNavPill || showMessagePill) ? (
    <>
      {showNavPill && (
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
      )}
      {showMessagePill && parsedMessage && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMessageOpen(true); }}
          className="mt-1.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-edge text-ink/70 text-2xs font-medium shadow-sm hover:border-teal hover:text-teal transition-colors cursor-pointer"
          title={parsedMessage.kind === 'email' ? 'View the email' : 'View the text message'}
        >
          {parsedMessage.kind === 'email'
            ? <Mail size={11} strokeWidth={2.5} />
            : <MessageSquare size={11} strokeWidth={2.5} />}
          <span>{parsedMessage.kind === 'email' ? 'View email' : 'View text'}</span>
        </button>
      )}
      {messageOpen && parsedMessage && (
        <Suspense fallback={null}>
          <NodeMessageModal
            message={parsedMessage}
            title={SHAPE_MESSAGE_TITLES[shape.shape_type] || 'Message'}
            onClose={() => setMessageOpen(false)}
          />
        </Suspense>
      )}
    </>
  ) : null;

  if (shape.shape_type === 'text') {
    return (
      <div className="relative flex flex-col items-center">
        {linkBadge}
        <div className="relative z-10">
          {platformBadgeEl}
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
        <div className="relative z-10">
          {diamondCorners}
          <DecisionShape shape={shape} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} />
        </div>
        {navPillEl}
        {description && <ShapeDescCard text={description} />}
      </div>
    );
  }

  if (shape.shape_type === 'wait') {
    const hasDesc = !!description;
    const navH = showNavPill ? 32 : 0;
    const msgH = showMessagePill ? 32 : 0;
    const cardPadTop = 20 + 4;
    const labelRow = 22;
    const descTextArea = hasDesc ? 56 + 10 : 0;
    const cardBottomPad = 10;
    const cardInner = cardPadTop + labelRow + navH + msgH + descTextArea + cardBottomPad;
    const frameH = DIAMOND_BOX_SIZE + Math.max(56, cardInner) - 20;
    const waitContent = parseWaitContent(shape.content);
    const waitLabel = waitContent.label?.trim() || `Wait ${formatWaitLabel(waitContent)}`;
    return (
      <>
        <DiamondNodeHandles readOnly={readOnly} frameH={frameH} />
        <div className="relative flex flex-col items-center" style={{ width: DIAMOND_FRAME_W, minHeight: frameH }}>
          <div className="relative z-10">
            {diamondCorners}
            <WaitDiamond shape={shape} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} hideLabel />
          </div>
          <div
            className="w-full bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.10)] border border-ink/15 flex flex-col items-center"
            style={{ marginTop: -20, paddingTop: 24, paddingBottom: cardBottomPad, minHeight: 56 }}
          >
            <span className="block text-detail text-ink/80 text-center leading-tight whitespace-nowrap px-2">{waitLabel}</span>
            {navPillEl}
            {hasDesc && (
              <p className="text-2xs text-ink/55 leading-snug whitespace-pre-wrap px-3 pt-1 w-full text-center">{description}</p>
            )}
          </div>
        </div>
      </>
    );
  }

  if (DIAMOND_TYPES.has(shape.shape_type)) {
    const hasDesc = !!description;
    const navH = showNavPill ? 32 : 0;
    const msgH = showMessagePill ? 32 : 0;
    const cardPadTop = 20 + 4;
    const labelRow = 22;
    const descTextArea = hasDesc ? 56 + 10 : 0;
    const cardBottomPad = 10;
    const cardInner = cardPadTop + labelRow + navH + msgH + descTextArea + cardBottomPad;
    const frameH = DIAMOND_BOX_SIZE + Math.max(56, cardInner) - 20;
    const eventContent = parseActionContent(shape.content);
    const eventConfig = DIAMOND_CONFIG[shape.shape_type as DiamondType];
    const eventLabel = eventContent.label || eventConfig?.placeholder || shape.shape_type;
    return (
      <>
        <DiamondNodeHandles readOnly={readOnly} frameH={frameH} />
        <div className="relative flex flex-col items-center" style={{ width: DIAMOND_FRAME_W, minHeight: frameH }}>
          <div className="relative z-10">
            {diamondCorners}
            <EventDiamond shape={shape} diamondType={shape.shape_type as DiamondType} selected={!!selected} readOnly={readOnly} onUpdateContent={onUpdateContent} hideLabel />
          </div>
          <div
            className="w-full bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.10)] border border-ink/15 flex flex-col items-center"
            style={{ marginTop: -20, paddingTop: 24, paddingBottom: cardBottomPad, minHeight: 56 }}
          >
            <span className="block text-detail text-ink/80 text-center leading-tight whitespace-nowrap px-2">{eventLabel}</span>
            {navPillEl}
            {hasDesc && (
              <p className="text-2xs text-ink/55 leading-snug whitespace-pre-wrap px-3 pt-1 w-full text-center">{description}</p>
            )}
          </div>
        </div>
      </>
    );
  }

  if (shape.shape_type === 'description_box') {
    return (
      <div className="relative flex flex-col items-center">
        {linkBadge}
        <div className="relative z-10">
          {platformBadgeEl}
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
    const label = shape.content?.trim();
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
        {label && (
          <div
            className="absolute inset-0 flex items-center justify-center text-center px-2 pointer-events-none whitespace-pre-wrap"
            style={{ fontSize: shape.font_size ?? 14, lineHeight: 1.3, color: shape.color || '#2B2B2B' }}
          >
            {label}
          </div>
        )}
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

  if (shape.shape_type === 'arrow' || shape.shape_type === 'line'
    || shape.shape_type === 'double_arrow' || shape.shape_type === 'elbow_arrow') {
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

    const isElbow = shape.shape_type === 'elbow_arrow';
    const hasEndHead = shape.shape_type === 'arrow' || shape.shape_type === 'double_arrow' || isElbow;
    const hasStartHead = shape.shape_type === 'double_arrow';

    const makeArrowHead = (tipX: number, tipY: number, fromX: number, fromY: number) => {
      const angle = Math.atan2(tipY - fromY, tipX - fromX);
      const a1 = angle + Math.PI - ARROW_ANGLE;
      const a2 = angle + Math.PI + ARROW_ANGLE;
      return `M ${tipX + Math.cos(a1) * ARROW_HEAD} ${tipY + Math.sin(a1) * ARROW_HEAD} L ${tipX} ${tipY} L ${tipX + Math.cos(a2) * ARROW_HEAD} ${tipY + Math.sin(a2) * ARROW_HEAD}`;
    };

    const elbowMidX = x2;
    const elbowMidY = y1;
    const linePath = isElbow
      ? `M ${x1} ${y1} L ${elbowMidX} ${elbowMidY} L ${x2} ${y2}`
      : undefined;

    const endHeadD = hasEndHead
      ? makeArrowHead(x2, y2, isElbow ? elbowMidX : x1, isElbow ? elbowMidY : y1)
      : '';
    const startHeadD = hasStartHead ? makeArrowHead(x1, y1, x2, y2) : '';

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
          {isElbow ? (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
            />
          )}
          {endHeadD && (
            <path d={endHeadD} fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeLinecap="round" strokeLinejoin="round" />
          )}
          {startHeadD && (
            <path d={startHeadD} fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeLinecap="round" strokeLinejoin="round" />
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
