// components/admin/page-editor/SortableTocRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, List, Trash2 } from 'lucide-react';

interface SortableTocRowProps {
  id: string;
  title: string;
  isSelected: boolean;
  onSelect: () => void;
  onRename?: (title: string) => void;
  onRemove?: () => void;
  renderInsertAfter?: React.ReactNode;
}

export default function SortableTocRow({
  id,
  title,
  isSelected,
  onSelect,
  onRename,
  onRemove,
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
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-amber-400/50 hover:text-amber-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>

        <span className="w-5 shrink-0" />
        <span className="w-7 shrink-0" />

        <List size={14} className="text-amber-500 shrink-0" />

        {onRename ? (
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={title || ''}
              onChange={(e) => onRename(e.target.value)}
              onFocus={onSelect}
              className="w-full px-2.5 py-1 rounded-lg border border-amber-200/60 bg-white text-amber-700 text-sm font-medium focus:outline-none focus:border-amber-400/60 placeholder:text-amber-300"
              placeholder="Table of Contents"
            />
          </div>
        ) : (
          <span className="text-sm font-medium text-amber-700 flex-1 truncate">
            {title || 'Table of Contents'}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-2xs text-amber-500/60 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded shrink-0">
            TOC
          </span>
          {onRemove && (
            <button
              onClick={onRemove}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remove table of contents"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {renderInsertAfter}
    </div>
  );
}