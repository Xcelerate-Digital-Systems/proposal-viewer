// components/admin/page-editor/SortableGroupRow.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FolderOpen, Trash2, Pencil, Check } from 'lucide-react';

interface SortableGroupRowProps {
  id: string;
  name: string;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}

export default function SortableGroupRow({ id, name, isSelected, onSelect, onRename, onRemove }: SortableGroupRowProps) {
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
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors border border-dashed ${
          isSelected
            ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200'
            : 'border-amber-200 hover:bg-amber-50/50'
        }`}
        onClick={onSelect}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-0.5 text-amber-300 hover:text-amber-500 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
        <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-amber-100">
          <FolderOpen size={13} className="text-amber-600" />
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
              className="flex-1 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        ) : (
          <span className="text-sm font-medium text-amber-700 flex-1 truncate uppercase tracking-wider text-xs">
            {name || 'Section Header'}
          </span>
        )}

        <span className="text-[9px] font-medium text-amber-400 uppercase tracking-wider shrink-0">
          Section
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditValue(name);
            setEditing(true);
          }}
          className="shrink-0 p-1 text-gray-300 hover:text-amber-600 transition-colors rounded"
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