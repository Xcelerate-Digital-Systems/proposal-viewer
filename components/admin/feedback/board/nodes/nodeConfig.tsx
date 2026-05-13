'use client';

import { Handle, Position } from '@xyflow/react';
import { Eye, MessageSquareText, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { FeedbackItem, FeedbackStatus } from '@/lib/supabase';
import { getFeedbackStatusDef, REVIEW_STATUS_OPTIONS } from '@/lib/feedback/status';

/* ─── Shared props every node receives ─────────────────────────── */

export interface NodeItemProps {
  item: FeedbackItem;
  selected: boolean;
  readOnly?: boolean;
  commentCount: number;
  unresolvedCount: number;
  onNavigate?: (id: string) => void;
  onUpdateStatus?: (itemId: string, status: FeedbackStatus) => void | Promise<void>;
}

/* ─── Reusable sub-components ──────────────────────────────────── */

/**
 * Renders connection handles on all 4 sides of a node. Every handle is
 * `type="source"`: React Flow's connection resolver uses the drag-start
 * handle's type to decide source/target, and with connectionMode="loose"
 * source→source connections are allowed — so this keeps the edge direction
 * always matching the drag direction (Miro-style). Duplicate legacy ids
 * (`*-source`, `*-target`) are preserved as aliases so previously-saved
 * edges don't lose their attachment point.
 */
export function NodeHandles({ readOnly }: { readOnly?: boolean }) {
  const handleClass =
    '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';
  return (
    <>
      <Handle id="left" type="source" position={Position.Left}
        className={`${handleClass} !-left-1.5`} isConnectable={!readOnly} />
      <Handle id="left-source" type="source" position={Position.Left}
        className={`${handleClass} !-left-1.5`} isConnectable={!readOnly} />

      <Handle id="right" type="source" position={Position.Right}
        className={`${handleClass} !-right-1.5`} isConnectable={!readOnly} />
      <Handle id="right-target" type="source" position={Position.Right}
        className={`${handleClass} !-right-1.5`} isConnectable={!readOnly} />

      <Handle id="top" type="source" position={Position.Top}
        className={`${handleClass} !-top-1.5`} isConnectable={!readOnly} />
      <Handle id="top-source" type="source" position={Position.Top}
        className={`${handleClass} !-top-1.5`} isConnectable={!readOnly} />

      <Handle id="bottom" type="source" position={Position.Bottom}
        className={`${handleClass} !-bottom-1.5`} isConnectable={!readOnly} />
      <Handle id="bottom-target" type="source" position={Position.Bottom}
        className={`${handleClass} !-bottom-1.5`} isConnectable={!readOnly} />
    </>
  );
}

export function StatusDot({ status }: { status: FeedbackStatus }) {
  const s = getFeedbackStatusDef(status);
  return (
    <div
      className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${s.dot}`}
      title={s.label}
    >
      <span className="text-white" style={{ fontSize: 8, lineHeight: 1 }}>
        {s.symbol}
      </span>
    </div>
  );
}

export function CommentBadge({ count, unresolved }: { count: number; unresolved: number }) {
  if (count === 0) return null;
  return (
    <div
      className={`absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white ${
        unresolved > 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {count}
    </div>
  );
}

export function StatusPill({ status }: { status: FeedbackStatus }) {
  const s = getFeedbackStatusDef(status);
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
      {s.icon}
      {s.label}
    </div>
  );
}

/* ─── Status picker — pill that doubles as a dropdown when onChange provided ─ */

interface StatusPickerProps {
  status: FeedbackStatus;
  onChange?: (status: FeedbackStatus) => void | Promise<void>;
  variant?: 'pill' | 'dot';
}

export function StatusPicker({ status, onChange, variant = 'pill' }: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getFeedbackStatusDef(status);
  const readOnly = !onChange;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (variant === 'dot') {
    // Icon-node variant — sits bottom-right, clickable when editable
    return (
      <div ref={ref} className="absolute -bottom-1 -right-1 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!readOnly) setOpen((o) => !o);
          }}
          className={`w-[22px] h-[22px] rounded-full border-2 border-white flex items-center justify-center shadow-sm transition-transform ${current.dot} ${
            readOnly ? 'cursor-default' : 'hover:scale-110 cursor-pointer'
          }`}
          title={current.label}
          type="button"
        >
          <span className="text-white" style={{ fontSize: 10, lineHeight: 1 }}>
            {current.symbol}
          </span>
        </button>
        {open && (
          <StatusDropdown
            currentValue={status}
            onPick={(next) => {
              setOpen(false);
              if (next !== status) void onChange?.(next);
            }}
            align="right"
          />
        )}
      </div>
    );
  }

  // Default pill variant for card nodes
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!readOnly) setOpen((o) => !o);
        }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${current.bg} ${current.text} ${current.border} ${
          readOnly ? 'cursor-default' : 'hover:brightness-95 cursor-pointer'
        }`}
        type="button"
      >
        {current.icon}
        {current.label}
        {!readOnly && <ChevronDown size={10} className="opacity-60" />}
      </button>
      {open && (
        <StatusDropdown
          currentValue={status}
          onPick={(next) => {
            setOpen(false);
            if (next !== status) void onChange?.(next);
          }}
        />
      )}
    </div>
  );
}

function StatusDropdown({
  currentValue, onPick, align = 'left',
}: {
  currentValue: FeedbackStatus;
  onPick: (s: FeedbackStatus) => void;
  align?: 'left' | 'right';
}) {
  return (
    <div
      className={`absolute top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} z-50 w-48 bg-white rounded-lg border border-edge shadow-lg py-1`}
      onClick={(e) => e.stopPropagation()}
    >
      {REVIEW_STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPick(opt.value)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-surface transition-colors ${
            opt.value === currentValue ? 'bg-surface' : ''
          }`}
          type="button"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
          <span className="text-ink truncate">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ViewButton({ id, onNavigate }: { id: string; onNavigate?: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onNavigate?.(id); }}
      className="flex items-center gap-1 text-sm text-teal hover:text-teal-hover transition-colors"
    >
      <Eye size={11} />
      View
    </button>
  );
}

/* ─── Card shell (shared wrapper for card-layout nodes) ────────── */

// Every board node renders inside a uniform 240×240 frame so cards, icon
// nodes, wait, and decision all line up on the same grid on the whiteboard.
// 240 is divisible by the 20px snap grid the board uses.
export const NODE_FRAME_W = 240;
export const NODE_FRAME_H = 240;

const CARD_W = NODE_FRAME_W;
const CARD_H = NODE_FRAME_H;

export function CardShell({
  item, selected, readOnly, commentCount, unresolvedCount, onNavigate, onUpdateStatus,
  typeIcon, typeLabel, children,
}: NodeItemProps & {
  typeIcon: React.ReactNode;
  typeLabel: string;
  children: React.ReactNode;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate?.(item.id);
  };

  return (
    <>
      <NodeHandles readOnly={readOnly} />

      <div
        className={`relative transition-shadow bg-white rounded-2xl border shadow-sm ${
          selected ? 'border-teal ring-2 ring-teal/30' : 'border-edge hover:shadow-md'
        } ${
          !readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
        style={{ width: CARD_W, minHeight: CARD_H }}
        onClick={readOnly ? handleClick : undefined}
      >
        <div className="relative z-10 px-4 py-4 flex flex-col gap-2.5">
          {/* Thumbnail area (crisp — preserves content legibility) */}
          <div className="relative h-[110px] overflow-hidden bg-surface rounded-lg border border-edge">
            {children}

            {/* Version badge only — type badge moved below */}
            {item.version > 1 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-white/95 text-[10px] font-medium text-ink border border-edge">
                v{item.version}
              </span>
            )}
          </div>

          {/* Type badge + title */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface text-[10px] font-medium text-ink/70 border border-edge">
              {typeIcon}
              {typeLabel}
            </span>
            <h4 className="text-base text-ink truncate leading-tight flex-1 min-w-0">
              {item.title}
            </h4>
          </div>

          {/* Status */}
          <StatusPicker
            status={item.status}
            onChange={onUpdateStatus ? (s) => onUpdateStatus(item.id, s) : undefined}
          />

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-edge">
            <div className="flex items-center gap-1 text-[11px] text-ink/60">
              <MessageSquareText size={11} />
              <span>
                {commentCount}
                {unresolvedCount > 0 && <span className="text-amber-600 ml-0.5 font-semibold">({unresolvedCount})</span>}
              </span>
            </div>
            <ViewButton id={item.id} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Icon shell (shared wrapper for icon-layout nodes) ────────── */

const ICON_SIZE = 88;

export function IconShell({
  item, selected, readOnly, commentCount, unresolvedCount, onNavigate, onUpdateStatus,
  icon, label, tint, solid,
}: NodeItemProps & {
  icon: React.ReactNode;
  label: string;
  tint: string;
  /** Funnelytics-style solid circle: full-bleed color, white icon (the icon
   * must already be colored white via className). Default false renders the
   * older tinted-pastel style. */
  solid?: boolean;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate?.(item.id);
  };

  return (
    <>
      <NodeHandles readOnly={readOnly} />
      <div
        className={`flex flex-col items-center ${
          !readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
        style={{ width: NODE_FRAME_W, height: NODE_FRAME_H }}
        onClick={readOnly ? handleClick : undefined}
      >
        {/* Title above the circle — matches diamond layout */}
        <div className="h-7 flex items-end pb-1 max-w-full px-1">
          <span className="block text-[11px] text-ink/80 text-center truncate max-w-[140px] leading-tight">
            {item.title}
          </span>
        </div>

        <div
          className={`relative flex items-center justify-center rounded-full shadow-[0_3px_8px_rgba(20,20,40,0.18)] transition-shadow ${
            selected ? 'ring-2 ring-teal ring-offset-2 ring-offset-paper' : 'hover:shadow-lg'
          } ${solid ? '' : 'border border-edge'}`}
          style={{ width: ICON_SIZE, height: ICON_SIZE, backgroundColor: tint }}
        >
          <div className={`relative z-10 ${solid ? '' : 'text-ink'}`}>{icon}</div>
          <StatusPicker
            status={item.status}
            onChange={onUpdateStatus ? (s) => onUpdateStatus(item.id, s) : undefined}
            variant="dot"
          />
          <CommentBadge count={commentCount} unresolved={unresolvedCount} />
        </div>

        <div className="mt-1.5 text-center max-w-full px-1">
          <span className="text-[10px] font-medium text-ink/50 block uppercase tracking-wider">
            {label}
          </span>
        </div>

        <div className="mt-1">
          <ViewButton id={item.id} onNavigate={onNavigate} />
        </div>
      </div>
    </>
  );
}

/* ─── Type registry (dispatcher uses this) ─────────────────────── */

export type NodeLayout = 'card' | 'icon';

export const NODE_LAYOUTS: Record<string, NodeLayout> = {
  webpage: 'card',
  image: 'card',
  video: 'card',
  pdf: 'card',
  email: 'icon',
  sms: 'icon',
  ad: 'icon',
  google_search_ad: 'icon',
  google_banner_ad: 'icon',
  meta_lead_form: 'card',
};