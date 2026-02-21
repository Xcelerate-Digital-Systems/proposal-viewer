// components/admin/templates/SortableTemplatePricingRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, DollarSign } from 'lucide-react';

interface SortableTemplatePricingRowProps {
  id: string;
  title: string;
  isSelected: boolean;
  onSelect: () => void;
}

export default function SortableTemplatePricingRow({
  id,
  title,
  isSelected,
  onSelect,
}: SortableTemplatePricingRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

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
            ? 'bg-[#017C87]/10 border-[#017C87]/40 ring-1 ring-[#017C87]/30'
            : 'border-[#017C87]/20 hover:bg-[#017C87]/5'
        }`}
        onClick={onSelect}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-[#017C87]/40 hover:text-[#017C87] cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
        <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-[#017C87]/10">
          <DollarSign size={13} className="text-[#017C87]" />
        </div>
        <span className="text-sm font-medium text-[#017C87] flex-1 truncate">
          {title || 'Pricing Page'}
        </span>
      </div>
    </div>
  );
}