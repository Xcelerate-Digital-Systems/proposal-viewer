// components/admin/page-editor/SortablePackagesRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowLeft, CornerDownRight, Package } from 'lucide-react';

interface SortablePackagesRowProps {
  id: string;
  title: string;
  indent: number;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleIndent: () => void;
}

export default function SortablePackagesRow({
  id, title, indent, isFirst, isSelected, onSelect, onToggleIndent,
}: SortablePackagesRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
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
            ? 'bg-[#017C87]/10 border-[#017C87]/40 ring-1 ring-[#017C87]/30'
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
        {/* Indent toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleIndent(); }}
          disabled={isFirst}
          title={indent ? 'Remove indent' : 'Indent under parent'}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors ${
            isFirst
              ? 'text-gray-200 cursor-not-allowed'
              : indent
              ? 'text-[#017C87] bg-[#017C87]/10 hover:bg-[#017C87]/20'
              : 'text-[#017C87]/40 hover:text-[#017C87] hover:bg-[#017C87]/10'
          }`}
        >
          {indent ? <ArrowLeft size={13} /> : <CornerDownRight size={13} />}
        </button>
        {/* Icon + label */}
        <Package size={14} className="text-[#017C87] shrink-0" />
        <span className={`text-sm font-medium truncate ${indent ? 'ml-4' : ''} text-[#017C87]`}>
          {title || 'Packages'}
        </span>
      </div>
    </div>
  );
}