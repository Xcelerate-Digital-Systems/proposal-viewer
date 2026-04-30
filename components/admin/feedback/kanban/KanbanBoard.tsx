'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import {
  supabase, type FeedbackItem, type FeedbackStatus,
} from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import {
  REVIEW_STATUS_ORDER, getFeedbackStatusDef,
} from '@/lib/feedback/status';
import KanbanCard from './KanbanCard';

interface KanbanBoardProps {
  items: FeedbackItem[];
  commentCounts: Record<string, { total: number; unresolved: number }>;
  onOpen: (itemId: string) => void;
  onItemsChange: (next: FeedbackItem[]) => void;
}

/**
 * Status columns — archived is intentionally last and always rendered, but users
 * can collapse everything by dragging items out of it. We keep all 8 statuses
 * visible so the board reflects the real workflow, including terminal states.
 */
const COLUMN_ORDER: FeedbackStatus[] = REVIEW_STATUS_ORDER;

export default function KanbanBoard({ items, commentCounts, onOpen, onItemsChange }: KanbanBoardProps) {
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Group items by status, preserving sort_order within each column.
  const columns = useMemo(() => {
    const map: Record<FeedbackStatus, FeedbackItem[]> = COLUMN_ORDER.reduce((acc, s) => {
      acc[s] = [];
      return acc;
    }, {} as Record<FeedbackStatus, FeedbackItem[]>);
    for (const item of items) {
      const key = (COLUMN_ORDER.includes(item.status) ? item.status : 'draft') as FeedbackStatus;
      map[key].push(item);
    }
    for (const key of COLUMN_ORDER) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [items]);

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  const handleDragStart = useCallback((ev: DragStartEvent) => {
    setActiveId(String(ev.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (ev: DragEndEvent) => {
      setActiveId(null);
      const itemId = String(ev.active.id);
      const overId = ev.over?.id ? String(ev.over.id) : null;
      if (!overId) return;

      // Drop zones are column containers identified by `column-<status>`.
      const targetStatus = overId.startsWith('column-')
        ? (overId.slice('column-'.length) as FeedbackStatus)
        : null;
      if (!targetStatus) return;

      const current = items.find((i) => i.id === itemId);
      if (!current || current.status === targetStatus) return;

      // Optimistic update — roll back if the write fails.
      const optimistic = items.map((i) => (i.id === itemId ? { ...i, status: targetStatus } : i));
      onItemsChange(optimistic);

      const { error } = await supabase
        .from('review_items')
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) {
        toast.error('Failed to update status');
        onItemsChange(items);
      }
    },
    [items, onItemsChange, toast]
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 lg:-mx-10 px-6 lg:px-10 min-h-[60vh]">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={columns[status]}
            commentCounts={commentCounts}
            onOpen={onOpen}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 rotate-1">
            <KanbanCard
              item={activeItem}
              commentCount={commentCounts[activeItem.id]?.total ?? 0}
              unresolvedCount={commentCounts[activeItem.id]?.unresolved ?? 0}
              onOpen={onOpen}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Column ───────────────────────────────────────────────────── */

function KanbanColumn({
  status, items, commentCounts, onOpen,
}: {
  status: FeedbackStatus;
  items: FeedbackItem[];
  commentCounts: Record<string, { total: number; unresolved: number }>;
  onOpen: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
  const def = getFeedbackStatusDef(status);

  return (
    <div className="shrink-0 w-[280px] flex flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${def.dot}`} />
        <h3 className="text-[13px] font-semibold text-gray-800">{def.label}</h3>
        <span className="text-[11px] font-medium text-gray-400">{items.length}</span>
      </div>

      {/* Droppable list */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-2xl p-3 space-y-2.5 min-h-[140px] transition-colors ${
          isOver ? 'bg-teal/10 ring-2 ring-teal/30' : 'bg-gray-50'
        }`}
      >
        {items.length === 0 ? (
          <div className="text-[11px] text-gray-400 italic text-center py-4">
            Drop here
          </div>
        ) : (
          items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              commentCount={commentCounts[item.id]?.total ?? 0}
              unresolvedCount={commentCounts[item.id]?.unresolved ?? 0}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}
