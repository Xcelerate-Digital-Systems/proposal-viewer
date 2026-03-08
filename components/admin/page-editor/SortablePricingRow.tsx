// components/admin/page-editor/SortablePricingRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowLeft, CornerDownRight, DollarSign, Trash2 } from 'lucide-react';
import PageLinkInput from '@/components/admin/page-editor/PageLinkInput';


interface SortablePricingRowProps {
  id: string;
  title: string;
  indent: number;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleIndent: () => void;
  onRemove: () => void;
  linkUrl: string;
  linkLabel: string;
  onLinkChange: (url: string, label: string) => void;
  /** Slot for rendering insert menu after this row */
  renderInsertAfter?: React.ReactNode;
}

export default function SortablePricingRow({ id, title, indent, isFirst, isSelected, onSelect, onToggleIndent, onRemove, linkUrl, linkLabel, onLinkChange, renderInsertAfter }: SortablePricingRowProps) {
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
        {/* Indent toggle — aligns with indent button column */}
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
        {indent > 0 && (
          <span className="text-[10px] text-[#017C87]/50 shrink-0">SUB</span>
        )}
        <DollarSign size={14} className="text-[#017C87] shrink-0" />
        <span className="text-sm font-medium text-[#017C87] flex-1 truncate">
          {title || 'Pricing Page'}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Page link */}
          <PageLinkInput
            linkUrl={linkUrl}
            linkLabel={linkLabel}
            onChange={onLinkChange}
            variant="teal"
          />

          {/* Remove button */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remove pricing page"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Insert-after slot */}
      {renderInsertAfter}
    </div>
  );
}