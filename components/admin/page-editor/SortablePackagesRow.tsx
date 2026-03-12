// components/admin/page-editor/SortablePackagesRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowLeft, CornerDownRight, Package, Loader2, Trash2 } from 'lucide-react';
import PageLinkInput from '@/components/admin/page-editor/PageLinkInput';

interface SortablePackagesRowProps {
  id: string;
  title: string;
  indent: number;
  isFirst: boolean;
  isSelected: boolean;
  processing?: boolean;
  onSelect: () => void;
  onToggleIndent: () => void;
  onRemove?: () => void;
  linkUrl: string;
  linkLabel: string;
  onLinkChange: (url: string, label: string) => void;
  renderInsertAfter?: React.ReactNode;
}

export default function SortablePackagesRow({
  id, title, indent, isFirst, isSelected, processing, onSelect, onToggleIndent, onRemove, linkUrl, linkLabel, onLinkChange, renderInsertAfter,
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
            ? 'bg-teal/10 border-teal/40 ring-1 ring-teal/30'
            : 'border-teal/20 hover:bg-teal/5'
        }`}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-teal/40 hover:text-teal cursor-grab active:cursor-grabbing touch-none"
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
              ? 'text-teal bg-teal/10 hover:bg-teal/20'
              : 'text-teal/40 hover:text-teal hover:bg-teal/10'
          }`}
        >
          {indent ? <ArrowLeft size={13} /> : <CornerDownRight size={13} />}
        </button>
        {/* Icon + label */}
        <Package size={14} className="text-teal shrink-0" />
        <span className={`text-sm font-medium truncate flex-1 ${indent ? 'ml-4' : ''} text-teal`}>
          {title || 'Packages'}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {processing && <Loader2 size={12} className="animate-spin text-teal/40" />}

          {/* Page link */}
          <PageLinkInput
            linkUrl={linkUrl}
            linkLabel={linkLabel}
            onChange={onLinkChange}
            variant="teal"
          />

          {/* Remove button */}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remove packages page"
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