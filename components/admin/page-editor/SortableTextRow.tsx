// components/admin/page-editor/SortableTextRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FileText, Trash2 } from 'lucide-react';

interface SortableTextRowProps {
  id: string;
  title: string;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export default function SortableTextRow({ id, title, isSelected, onSelect, onRemove }: SortableTextRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors border border-dashed ${
          isSelected
            ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-200'
            : 'border-purple-200 hover:bg-purple-50/50'
        }`}
        onClick={onSelect}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-purple-300 hover:text-purple-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
        <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-purple-100">
          <FileText size={13} className="text-purple-600" />
        </div>
        <span className="text-sm font-medium text-purple-700 flex-1 truncate">{title || 'Text Page'}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
          title="Remove text page"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}