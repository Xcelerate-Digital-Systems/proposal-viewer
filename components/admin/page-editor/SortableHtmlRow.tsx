// components/admin/page-editor/SortableHtmlRow.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowLeft, CornerDownRight, Trash2, Code2, BookOpen, List } from 'lucide-react';

interface SortableHtmlRowProps {
  id: string;
  title: string;
  indent: number;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleIndent: () => void;
  onRemove: () => void;
  onSaveToLibrary?: () => void;
  tocIncluded?: boolean;
  onToggleTocInclude?: () => void;
  renderInsertAfter?: React.ReactNode;
}

export default function SortableHtmlRow({
  id,
  title,
  indent,
  isFirst,
  isSelected,
  onSelect,
  onToggleIndent,
  onRemove,
  onSaveToLibrary,
  tocIncluded,
  onToggleTocInclude,
  renderInsertAfter,
}: SortableHtmlRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
            ? 'bg-teal/5 border-teal/40 ring-1 ring-teal/20'
            : 'border-teal/20 hover:bg-teal/5'
        }`}
        onClick={onSelect}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-teal/40 hover:text-teal cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>

        <span className="w-5 shrink-0" />

        <button
          onClick={(e) => { e.stopPropagation(); onToggleIndent(); }}
          disabled={isFirst}
          title={indent ? 'Remove indent' : 'Indent under parent'}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors ${
            isFirst
              ? 'text-edge-hover cursor-not-allowed'
              : indent
              ? 'text-teal bg-teal/10 hover:bg-teal/20'
              : 'text-teal/40 hover:text-teal hover:bg-teal/10'
          }`}
        >
          {indent ? <ArrowLeft size={13} /> : <CornerDownRight size={13} />}
        </button>

        {indent > 0 && (
          <span className="text-2xs text-teal/50 shrink-0">SUB</span>
        )}

        <Code2 size={14} className="text-teal/70 shrink-0" />
        <span className="text-sm font-medium text-teal/70 flex-1 truncate">
          {title || 'HTML Page'}
        </span>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onToggleTocInclude && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTocInclude(); }}
              className={`shrink-0 w-7 h-7 flex items-center justify-center rounded border transition-colors ${
                tocIncluded
                  ? 'text-teal border-teal/25 bg-teal/5 hover:bg-teal/10'
                  : 'text-faint border-edge hover:text-dim hover:bg-paper'
              }`}
              title={tocIncluded ? 'Included in contents' : 'Excluded from contents'}
            >
              <List size={12} />
            </button>
          )}
          {onSaveToLibrary && (
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToLibrary(); }}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-faint hover:text-teal hover:bg-teal/5 transition-colors"
              title="Save to page library"
            >
              <BookOpen size={12} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remove HTML page"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {renderInsertAfter}
    </div>
  );
}
