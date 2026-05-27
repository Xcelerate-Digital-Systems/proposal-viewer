'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  MessageSquareText, ExternalLink, Globe, Mail, Smartphone,
  Image as ImageIcon, Video, FileText, Megaphone, Search, RectangleHorizontal, ClipboardList,
} from 'lucide-react';
import type {
  FeedbackItem, FeedbackItemType, FeedbackStatus, FeedbackComment,
} from '@/lib/types/feedback';
import { getFeedbackStatusDef } from '@/lib/feedback/status';
import type { CompanyBranding } from '@/hooks/useProposal';

interface PublicKanbanViewProps {
  items: FeedbackItem[];
  comments: FeedbackComment[];
  onSelectItem: (itemId: string) => void;
  /** Persists a status change. Throws / rejects when the update fails so we
   *  can roll back the optimistic UI move. */
  onUpdateStatus: (itemId: string, status: FeedbackStatus) => Promise<void> | void;
  branding: CompanyBranding;
}

const TYPE_META: Record<FeedbackItemType, { label: string; Icon: typeof Globe; iconBg: string; iconColor: string }> = {
  webpage:   { label: 'Webpage',   Icon: Globe,      iconBg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  email:     { label: 'Email',     Icon: Mail,       iconBg: 'bg-violet-50',  iconColor: 'text-violet-600' },
  sms:       { label: 'SMS',       Icon: Smartphone, iconBg: 'bg-green-50',   iconColor: 'text-green-600' },
  image:     { label: 'Image',     Icon: ImageIcon,  iconBg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  video:     { label: 'Video',     Icon: Video,      iconBg: 'bg-rose-50',    iconColor: 'text-rose-600' },
  pdf:       { label: 'PDF',       Icon: FileText,   iconBg: 'bg-red-50',     iconColor: 'text-red-600' },
  ad:        { label: 'Meta Ad',   Icon: Megaphone,  iconBg: 'bg-blue-50',    iconColor: 'text-blue-600' },
  google_search_ad: { label: 'Google Search Ad', Icon: Search,              iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600' },
  google_banner_ad: { label: 'Google Banner Ad', Icon: RectangleHorizontal, iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600' },
  meta_lead_form: { label: 'Lead Form', Icon: ClipboardList, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
};

/** Statuses the client can both see and drop into on the public board.
 *  Internal statuses (draft, in_progress, internal_review, archived) are
 *  hidden entirely so the client view only surfaces what they can act on.
 *  Mirrors the public status endpoint allowlist — anything else is rejected
 *  server-side anyway. */
const CLIENT_ALLOWED_STATUSES: FeedbackStatus[] = [
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
];

/**
 * Public Kanban — only the client-actionable columns are shown, and cards
 * can be dragged freely between them in either direction. Items that are
 * still in an internal status (draft / in_progress / internal_review /
 * archived) are filtered out so the client view stays focused. Visual parity
 * with the admin board, with the agency's accent colour applied to the
 * column headers + drop ring.
 */
export default function PublicKanbanView({
  items, comments, onSelectItem, onUpdateStatus, branding,
}: PublicKanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const accent = branding.accent_color || '#0f766e';

  const commentCounts = useMemo(() => {
    const counts: Record<string, { total: number; unresolved: number }> = {};
    for (const c of comments) {
      if (c.parent_comment_id) continue;
      const id = c.review_item_id;
      if (!counts[id]) counts[id] = { total: 0, unresolved: 0 };
      counts[id].total += 1;
      if (!c.resolved) counts[id].unresolved += 1;
    }
    return counts;
  }, [comments]);

  const columns = useMemo(() => {
    const map: Record<FeedbackStatus, FeedbackItem[]> = CLIENT_ALLOWED_STATUSES.reduce((acc, s) => {
      acc[s] = [];
      return acc;
    }, {} as Record<FeedbackStatus, FeedbackItem[]>);
    for (const item of items) {
      // Skip items in internal statuses — they don't appear on the client board.
      if (!CLIENT_ALLOWED_STATUSES.includes(item.status)) continue;
      map[item.status].push(item);
    }
    for (const key of CLIENT_ALLOWED_STATUSES) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [items]);

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  const handleDragStart = useCallback((ev: DragStartEvent) => {
    setActiveId(String(ev.active.id));
  }, []);

  const handleDragEnd = useCallback(async (ev: DragEndEvent) => {
    setActiveId(null);
    const itemId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;
    if (!overId || !overId.startsWith('column-')) return;

    const targetStatus = overId.slice('column-'.length) as FeedbackStatus;
    const current = items.find((i) => i.id === itemId);
    if (!current) return;

    // Allow free movement between any client-allowed columns (both directions).
    // Server-side endpoint also enforces this allowlist.
    if (!CLIENT_ALLOWED_STATUSES.includes(targetStatus)) return;
    if (current.status === targetStatus) return;

    await onUpdateStatus(itemId, targetStatus);
  }, [items, onUpdateStatus]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto px-6 lg:px-10 py-6 h-full">
        {CLIENT_ALLOWED_STATUSES.map((status) => {
          // Any client-allowed column is a valid drop target except the source
          // column itself.
          const isDropAllowed = activeItem ? activeItem.status !== status : false;

          return (
            <KanbanColumn
              key={status}
              status={status}
              items={columns[status]}
              commentCounts={commentCounts}
              onSelectItem={onSelectItem}
              accent={accent}
              dragActive={!!activeItem}
              isDropAllowed={isDropAllowed}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 rotate-1">
            <KanbanCardView
              item={activeItem}
              counts={commentCounts[activeItem.id] ?? { total: 0, unresolved: 0 }}
              isDragging={false}
              accent={accent}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Column ───────────────────────────────────────────────────── */

function KanbanColumn({
  status, items, commentCounts, onSelectItem, accent, dragActive, isDropAllowed,
}: {
  status: FeedbackStatus;
  items: FeedbackItem[];
  commentCounts: Record<string, { total: number; unresolved: number }>;
  onSelectItem: (itemId: string) => void;
  accent: string;
  dragActive: boolean;
  isDropAllowed: boolean;
}) {
  // Disabled (backwards / not-client-allowed) drop zones don't register, so
  // dnd-kit's `over` never fires for them.
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    disabled: dragActive && !isDropAllowed,
  });
  const def = getFeedbackStatusDef(status);

  const ringStyle = isOver
    ? { backgroundColor: `${accent}15`, boxShadow: `0 0 0 2px ${accent}55 inset` }
    : undefined;

  return (
    <div className="shrink-0 w-[280px] flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className={`w-2 h-2 rounded-full ${def.dot}`} />
        <h3 className="text-caption font-semibold text-gray-800">{def.label}</h3>
        <span className="text-detail font-medium text-faint">{items.length}</span>
      </div>

      <div
        ref={setNodeRef}
        style={ringStyle}
        className={`flex-1 rounded-2xl p-3 space-y-2.5 overflow-y-auto transition-colors ${
          dragActive && !isDropAllowed ? 'bg-surface opacity-60' : 'bg-surface'
        }`}
      >
        {items.length === 0 ? (
          <div className="text-detail text-faint italic text-center py-4">
            {dragActive && !isDropAllowed ? 'Locked' : 'Empty'}
          </div>
        ) : (
          items.map((item) => (
            <DraggableKanbanCard
              key={item.id}
              item={item}
              counts={commentCounts[item.id] ?? { total: 0, unresolved: 0 }}
              onSelectItem={onSelectItem}
              accent={accent}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Card (draggable wrapper + presentational view) ──────────────── */

function DraggableKanbanCard({
  item, counts, onSelectItem, accent,
}: {
  item: FeedbackItem;
  counts: { total: number; unresolved: number };
  onSelectItem: (itemId: string) => void;
  accent: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { kind: 'item' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const meta = TYPE_META[item.type];
  const Icon = meta.Icon;
  const isWebpage = item.type === 'webpage';

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`relative bg-white rounded-2xl shadow-card-soft hover:shadow-card-hover p-3.5 transition-all ${
          isDragging ? 'ring-2' : ''
        }`}
        style={isDragging ? { boxShadow: `0 0 0 2px ${accent}66` } : undefined}
      >
        {/* Top half acts as the drag handle — large grab target. */}
        <div
          {...listeners}
          {...attributes}
          className="flex items-start gap-2.5 cursor-grab active:cursor-grabbing -m-3.5 p-3.5 rounded-t-2xl"
          aria-label={`Drag ${item.title}`}
        >
          <div className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center ${meta.iconBg}`}>
            <Icon size={15} className={meta.iconColor} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h4 className="text-caption font-medium text-ink truncate leading-tight flex-1 min-w-0">
                {item.title}
              </h4>
              {item.version > 1 && (
                <span className="text-2xs font-semibold text-faint shrink-0">v{item.version}</span>
              )}
            </div>
            <p className="text-detail text-faint mt-0.5 truncate">{meta.label}</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
          <div className="flex items-center gap-1 text-detail text-dim">
            <MessageSquareText size={11} />
            <span>
              {counts.total}
              {counts.unresolved > 0 && (
                <span className="text-amber-600 ml-0.5 font-semibold">({counts.unresolved})</span>
              )}
            </span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSelectItem(item.id); }}
            className="relative z-10 inline-flex items-center gap-1 text-detail font-medium"
            style={{ color: accent }}
          >
            {isWebpage ? <ExternalLink size={11} /> : null}
            Open
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanCardView({
  item, counts, isDragging, accent,
}: {
  item: FeedbackItem;
  counts: { total: number; unresolved: number };
  isDragging: boolean;
  accent: string;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.Icon;
  return (
    <div
      className={`relative bg-white rounded-2xl shadow-card-soft p-3.5 ${
        isDragging ? 'ring-2' : ''
      }`}
      style={isDragging ? { boxShadow: `0 0 0 2px ${accent}66` } : undefined}
    >
      <div className="flex items-start gap-2.5">
        <div className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center ${meta.iconBg}`}>
          <Icon size={15} className={meta.iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-caption font-medium text-ink truncate leading-tight">{item.title}</h4>
          <p className="text-detail text-faint mt-0.5 truncate">{meta.label}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
        <div className="flex items-center gap-1 text-detail text-dim">
          <MessageSquareText size={11} />
          <span>
            {counts.total}
            {counts.unresolved > 0 && (
              <span className="text-amber-600 ml-0.5 font-semibold">({counts.unresolved})</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
