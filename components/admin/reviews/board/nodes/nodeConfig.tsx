// components/admin/reviews/board/nodes/nodeConfig.tsx
'use client';

import { Handle, Position } from '@xyflow/react';
import {
  Eye, CheckCircle2, AlertCircle, Clock, MessageSquareText,
} from 'lucide-react';
import type { ReviewItem, ReviewItemStatus } from '@/lib/supabase';

/* ─── Status config ────────────────────────────────────────────── */

export interface StatusDef {
  label: string;
  color: string;
  bg: string;
  dot: string;
  symbol: string;
  icon: React.ReactNode;
}

export const STATUS_CONFIG: Record<ReviewItemStatus, StatusDef> = {
  draft:           { label: 'Draft',     color: 'text-gray-500',     bg: 'bg-gray-100',   dot: 'bg-gray-400',    symbol: '',  icon: <Clock size={10} /> },
  in_review:       { label: 'In Review', color: 'text-blue-600',     bg: 'bg-blue-50',    dot: 'bg-blue-500',    symbol: '◉', icon: <Eye size={10} /> },
  approved:        { label: 'Approved',  color: 'text-emerald-600',  bg: 'bg-emerald-50', dot: 'bg-emerald-500', symbol: '✓', icon: <CheckCircle2 size={10} /> },
  revision_needed: { label: 'Revision',  color: 'text-amber-600',    bg: 'bg-amber-50',   dot: 'bg-amber-500',  symbol: '!', icon: <AlertCircle size={10} /> },
};

/* ─── Shared props every node receives ─────────────────────────── */

export interface NodeItemProps {
  item: ReviewItem;
  selected: boolean;
  readOnly?: boolean;
  commentCount: number;
  unresolvedCount: number;
  onNavigate?: (id: string) => void;
}

/* ─── Reusable sub-components ──────────────────────────────────── */

export function NodeHandles({ readOnly }: { readOnly?: boolean }) {
  return (
    <>
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-gray-300 !border-2 !border-white hover:!bg-[#017C87] transition-colors !-left-1.5"
        isConnectable={!readOnly}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-gray-300 !border-2 !border-white hover:!bg-[#017C87] transition-colors !-right-1.5"
        isConnectable={!readOnly}
      />
    </>
  );
}

export function StatusDot({ status }: { status: ReviewItemStatus }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
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

export function StatusPill({ status }: { status: ReviewItemStatus }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.color}`}>
      {s.icon}
      {s.label}
    </div>
  );
}

export function ViewButton({ id, onNavigate }: { id: string; onNavigate?: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onNavigate?.(id); }}
      className="flex items-center gap-1 text-[10px] font-medium text-[#017C87] hover:text-[#01434A] transition-colors"
    >
      <Eye size={10} />
      View
    </button>
  );
}

/* ─── Card shell (shared wrapper for card-layout nodes) ────────── */

export function CardShell({
  item, selected, readOnly, commentCount, unresolvedCount, onNavigate,
  typeIcon, typeLabel, children,
}: NodeItemProps & {
  typeIcon: React.ReactNode;
  typeLabel: string;
  children: React.ReactNode;
}) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate?.(item.id);
  };

  return (
    <>
      <NodeHandles readOnly={readOnly} />

      <div
        className={`
          w-[220px] bg-white rounded-xl shadow-sm border transition-all
          ${selected ? 'border-[#017C87] shadow-md ring-2 ring-[#017C87]/20' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
          ${!readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        `}
        onClick={readOnly ? handleClick : undefined}
      >
        {/* Thumbnail area */}
        <div className="w-full h-[120px] rounded-t-xl overflow-hidden relative bg-gray-50">
          {children}

          {/* Type badge */}
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[9px] font-medium text-gray-500 border border-gray-200/60 flex items-center gap-1">
            {typeIcon}
            {typeLabel}
          </span>

          {/* Version badge */}
          {item.version > 1 && (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[9px] font-medium text-gray-500 border border-gray-200/60">
              v{item.version}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-3 py-2.5">
          <h4 className="text-xs font-semibold text-gray-900 truncate mb-2 leading-tight">
            {item.title}
          </h4>
          <StatusPill status={item.status} />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <MessageSquareText size={10} />
              <span>
                {commentCount}
                {unresolvedCount > 0 && <span className="text-amber-500 ml-0.5">({unresolvedCount})</span>}
              </span>
            </div>
            <ViewButton id={item.id} onNavigate={onNavigate} />
          </div>
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
  email: 'icon',
  sms: 'icon',
  ad: 'icon',
};