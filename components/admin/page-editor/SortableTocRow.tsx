// components/admin/page-editor/SortableTocRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, List } from 'lucide-react';

interface SortableTocRowProps {
  id: string;
  title: string;
  isSelected: boolean;
  onSelect: () => void;
  /** Slot for rendering insert menu after this row */
  renderInsertAfter?: React.ReactNode;
}

export default function SortableTocRow({
  id,
  title,
  isSelected,
  onSelect,
  renderInsertAfter,
}: SortableTocRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-5">
      <div
        className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 cursor-pointer transition-colors border border-dashed ${
          isSelected
            ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
            : 'border-amber-400/30 hover:bg-amber-50/60'
        }`}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-amber-400/50 hover:text-amber-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>

        {/* Spacer to align with page number + indent button columns */}
        <span className="w-5 shrink-0" />
        <span className="w-7 shrink-0" />

        <List size={14} className="text-amber-500 shrink-0" />
        <span className="text-sm font-medium text-amber-700 flex-1 truncate">
          {title || 'Table of Contents'}
        </span>

        {/* Read-only badge — managed in TOC tab */}
        <span className="text-[10px] text-amber-500/60 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded shrink-0">
          TOC
        </span>
      </div>

      {/* Insert-after slot */}
      {renderInsertAfter}
    </div>
  );
}