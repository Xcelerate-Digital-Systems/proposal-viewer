'use client';

/**
 * Reusable kanban board used by /feedback, /proposals, and /quotes.
 *
 * Generic over the row type — the caller hands us columns of items, a card
 * renderer, and an `onMove(itemId, from, to)` callback. We handle the DnD
 * plumbing (drag layer, column drop targets, optimistic state, scrolling).
 *
 * Reordering within a column is intentionally out of scope: the data model
 * here is "items have a status, drop into a column == change status". We
 * keep this minimal so the surface area for bugs stays small.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

export interface KanbanColumn<T extends { id: string }> {
  /** Column key — matches the value stored in the item's status field. */
  id: string;
  label: string;
  /** Solid hex used for the dot + column accent. */
  accentHex: string;
  items: T[];
  /** Disable dropping into this column (useful for outcome-driven stages). */
  dropDisabled?: boolean;
}

interface Props<T extends { id: string }> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T) => React.ReactNode;
  /** Called when a card lands in a new column. Should throw on failure so
   *  the optimistic UI can roll back. */
  onMove: (itemId: string, fromColumnId: string, toColumnId: string) => Promise<void> | void;
  /** Tooltip shown on disabled columns (e.g. "Set automatically when the client accepts"). */
  disabledHint?: (columnId: string) => string | undefined;
  emptyMessage?: string;
}

export default function KanbanBoard<T extends { id: string }>({
  columns,
  renderCard,
  onMove,
  disabledHint,
  emptyMessage = 'Nothing here yet.',
}: Props<T>) {
  // Local mirror of the columns so we can apply optimistic moves before the
  // server roundtrip finishes (and roll back on error). The parent re-fetches
  // on success which then becomes the source of truth via the props effect.
  const [local, setLocal] = useState(columns);
  useEffect(() => setLocal(columns), [columns]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    for (const col of local) {
      const found = col.items.find((it) => it.id === activeId);
      if (found) return { item: found, columnId: col.id };
    }
    return null;
  }, [activeId, local]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overCol = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!overCol) return;

    // Find source column
    let fromCol: string | null = null;
    for (const col of local) {
      if (col.items.some((it) => it.id === id)) {
        fromCol = col.id;
        break;
      }
    }
    if (!fromCol || fromCol === overCol) return;

    // Block dropping into a disabled column
    const target = local.find((c) => c.id === overCol);
    if (!target || target.dropDisabled) return;

    // Optimistic move
    const prev = local;
    setLocal((cols) =>
      cols.map((col) => {
        if (col.id === fromCol) return { ...col, items: col.items.filter((it) => it.id !== id) };
        if (col.id === overCol) {
          const moved = prev.find((c) => c.id === fromCol)!.items.find((it) => it.id === id)!;
          return { ...col, items: [moved, ...col.items] };
        }
        return col;
      }),
    );

    try {
      await onMove(id, fromCol, overCol);
    } catch (err) {
      console.error('Kanban move failed:', err);
      setLocal(prev);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {local.map((col) => (
          <KanbanColumnView
            key={col.id}
            column={col}
            renderCard={renderCard}
            emptyMessage={emptyMessage}
            disabledHint={disabledHint?.(col.id)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="opacity-90 rotate-1 cursor-grabbing">{renderCard(activeItem.item)}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Column ─────────────────────────────────────────────── */

function KanbanColumnView<T extends { id: string }>({
  column,
  renderCard,
  emptyMessage,
  disabledHint,
}: {
  column: KanbanColumn<T>;
  renderCard: (item: T) => React.ReactNode;
  emptyMessage: string;
  disabledHint?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const disabled = column.dropDisabled;
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-shrink-0 w-[280px] rounded-2xl border transition-colors ${
        isOver && !disabled
          ? 'border-teal/40 bg-teal/5'
          : 'border-edge bg-surface/40'
      }`}
      title={disabled ? disabledHint : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge/60">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: column.accentHex }}
          />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-ink truncate">
            {column.label}
          </span>
          <span className="text-[11px] text-faint">{column.items.length}</span>
        </div>
      </div>
      <div className="flex-1 px-3 py-3 space-y-2 min-h-[120px] max-h-[calc(100dvh-280px)] overflow-y-auto">
        {column.items.length === 0 ? (
          <div className="text-[11px] text-faint text-center py-6">{emptyMessage}</div>
        ) : (
          column.items.map((item) => (
            <KanbanCardWrapper key={item.id} id={item.id}>
              {renderCard(item)}
            </KanbanCardWrapper>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Card wrapper (drag handle) ─────────────────────────── */

function KanbanCardWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        // Hide the card in its source slot while the overlay floats — avoids
        // the "ghost twin" effect during drag.
        opacity: isDragging ? 0 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className="cursor-grab active:cursor-grabbing touch-none"
    >
      {children}
    </div>
  );
}
