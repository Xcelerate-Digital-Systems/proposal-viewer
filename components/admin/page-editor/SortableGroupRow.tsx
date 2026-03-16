// components/admin/page-editor/SortableGroupRow.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FolderOpen, Trash2, Pencil, ArrowLeft, CornerDownRight } from 'lucide-react';

interface SortableGroupRowProps {
  id: string;
  name: string;
  indent: number;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onToggleIndent: () => void;
  onRemove: () => void;
}

export default function SortableGroupRow({ id, name, indent, isFirst, isSelected, onSelect, onRename, onToggleIndent, onRemove }: SortableGroupRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setEditValue(name);
    }
    setEditing(false);
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

        {indent > 0 && (
          <span className="text-[10px] text-teal/50 shrink-0">SUB</span>
        )}

        <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-teal/10">
          <FolderOpen size={13} className="text-teal" />
        </div>

        {editing ? (
          <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setEditValue(name); setEditing(false); }
              }}
              onBlur={handleSave}
              className="flex-1 text-sm font-medium text-teal bg-white border border-teal/30 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal/40"
            />
          </div>
        ) : (
          <span className="text-sm font-medium text-teal flex-1 truncate uppercase tracking-wider text-xs">
            {name || 'Section Header'}
          </span>
        )}

        <span className="text-[9px] font-medium text-teal/50 uppercase tracking-wider shrink-0">
          Section
        </span>

        {/* Spacer to align with save-status column */}
        <span className="w-5 shrink-0" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditValue(name);
            setEditing(true);
          }}
          className="shrink-0 p-1 text-gray-300 hover:text-teal transition-colors rounded"
          title="Rename section"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
          title="Remove section header"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}