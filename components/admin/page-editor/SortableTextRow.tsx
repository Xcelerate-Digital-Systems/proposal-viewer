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
    <div ref={setNodeRef} style={style} className="mb-2">
      <div
        className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 cursor-pointer transition-colors border border-dashed ${
          isSelected
            ? 'bg-[#017C87]/5 border-[#017C87]/40 ring-1 ring-[#017C87]/20'
            : 'border-[#017C87]/20 hover:bg-[#017C87]/5'
        }`}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-[#017C87]/40 hover:text-[#017C87] cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
        {/* Spacer to align with page number column */}
        <span className="w-5 shrink-0" />
        {/* Icon — aligns with indent button column */}
        <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-[#017C87]/10">
          <FileText size={13} className="text-[#017C87]" />
        </div>
        <span className="text-sm font-medium text-[#017C87] flex-1 truncate">{title || 'Text Page'}</span>
        {/* Spacer to align with save-status column */}
        <span className="w-5 shrink-0" />
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