'use client';

import { Handle, Position } from '@xyflow/react';
import { Eye, MessageSquareText, ChevronDown } from 'lucide-react';
import { useMemo, useState, useRef, useEffect } from 'react';
import type { FeedbackItem, FeedbackStatus } from '@/lib/supabase';
import { getFeedbackStatusDef, REVIEW_STATUS_OPTIONS } from '@/lib/feedback/status';
import { SketchyFrame } from '@/components/feedback/sketchy/SketchyFrame';
import { roughCircle } from '@/components/feedback/sketchy/roughPath';
import { hashStringToInt } from '@/components/feedback/sketchy/seed';

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

export function NodeHandles({ readOnly }: { readOnly?: boolean }) {
  return (
    <>
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors !-left-1.5"
        isConnectable={!readOnly}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors !-right-1.5"
        isConnectable={!readOnly}
      />
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
          className={`w-[22px] h-[22px] rounded-full border-2 border-paper flex items-center justify-center shadow-sketch transition-transform ${current.dot} ${
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
      className={`absolute top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} z-50 w-48 bg-paper rounded-lg border-2 border-sketch-ink/60 shadow-sketch-lg py-1`}
      onClick={(e) => e.stopPropagation()}
    >
      {REVIEW_STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPick(opt.value)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-paper-dark transition-colors ${
            opt.value === currentValue ? 'bg-paper-dark' : ''
          }`}
          type="button"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
          <span className="text-sketch-ink truncate">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ViewButton({ id, onNavigate }: { id: string; onNavigate?: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onNavigate?.(id); }}
      className="flex items-center gap-1 text-sm font-hand text-teal hover:text-teal-hover transition-colors"
    >
      <Eye size={11} />
      View
    </button>
  );
}

/* ─── Card shell (shared wrapper for card-layout nodes) ────────── */

const CARD_W = 236;
const CARD_H = 252;

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

  const seed = hashStringToInt(item.id);

  return (
    <>
      <NodeHandles readOnly={readOnly} />

      <div
        className={`relative transition-transform ${
          !readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
        style={{ width: CARD_W, minHeight: CARD_H }}
        onClick={readOnly ? handleClick : undefined}
      >
        <SketchyFrame
          w={CARD_W}
          h={CARD_H}
          variant="card"
          seed={seed}
          fill="#FAFAFA"
          selected={selected}
          strokeWidth={selected ? 2.4 : 1.6}
          roughness={1.3}
        />

        {/* Inner content with breathing room from sketch border */}
        <div className="relative z-10 px-4 py-4 flex flex-col gap-2.5">
          {/* Thumbnail area (crisp — preserves content legibility) */}
          <div className="relative h-[110px] overflow-hidden bg-paper-dark rounded-lg border border-sketch-ink/20">
            {children}

            {/* Version badge only — type badge moved below */}
            {item.version > 1 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-paper/95 text-[10px] font-medium text-sketch-ink border border-sketch-ink/30 font-hand">
                v{item.version}
              </span>
            )}
          </div>

          {/* Type badge + title */}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-paper-dark text-[10px] font-medium text-sketch-ink/70 border border-sketch-ink/20 font-hand">
              {typeIcon}
              {typeLabel}
            </span>
            <h4 className="font-hand text-base text-sketch-ink truncate leading-tight flex-1 min-w-0">
              {item.title}
            </h4>
          </div>

          {/* Status */}
          <StatusPicker
            status={item.status}
            onChange={onUpdateStatus ? (s) => onUpdateStatus(item.id, s) : undefined}
          />

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-sketch-ink/15">
            <div className="flex items-center gap-1 text-[11px] text-sketch-ink/60">
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
  icon, label, tint,
}: NodeItemProps & {
  icon: React.ReactNode;
  label: string;
  tint: string;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate?.(item.id);
  };
  const seed = hashStringToInt(item.id);
  const stroke = selected ? '#017C87' : '#2B2B2B';
  const strokeWidth = selected ? 2.6 : 1.9;

  const paths = useMemo(
    () =>
      roughCircle(ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE - strokeWidth * 2 - 4, {
        seed,
        roughness: 1.8,
        bowing: 1.8,
        stroke,
        strokeWidth,
        fill: tint,
        fillStyle: 'solid',
        disableMultiStroke: false,
      }),
    [seed, stroke, strokeWidth, tint]
  );

  return (
    <>
      <NodeHandles readOnly={readOnly} />
      <div
        className={`flex flex-col items-center w-[140px] ${
          !readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
        onClick={readOnly ? handleClick : undefined}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
        >
          <svg
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
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
          <div className="relative z-10 text-sketch-ink">{icon}</div>
          <StatusPicker
            status={item.status}
            onChange={onUpdateStatus ? (s) => onUpdateStatus(item.id, s) : undefined}
            variant="dot"
          />
          <CommentBadge count={commentCount} unresolved={unresolvedCount} />
        </div>

        <div className="mt-2 text-center max-w-full px-1">
          <h4 className="font-hand text-base text-sketch-ink truncate leading-tight">
            {item.title}
          </h4>
          <span className="text-[11px] font-medium text-sketch-ink/60 mt-0.5 block uppercase tracking-wider">
            {label}
          </span>
        </div>

        <div className="mt-1.5">
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
  google_ad: 'icon',
};