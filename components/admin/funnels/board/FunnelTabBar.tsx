'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import type { FunnelTab } from '@/lib/supabase';

interface Props {
  tabs: FunnelTab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onCreate?: (name?: string) => void;
  onRename?: (id: string, name: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}

export default function FunnelTabBar({
  tabs, activeTabId, onSwitch, onCreate, onRename, onReorder, onDelete, readOnly,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  const sorted = [...tabs].sort((a, b) => a.position - b.position);

  const commitRename = (id: string) => {
    const trimmed = editDraft.trim();
    setEditingId(null);
    if (trimmed && onRename) onRename(id, trimmed);
  };

  const handleDragStart = (id: string) => {
    if (readOnly) return;
    setDragId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragId) setDragOverId(id);
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId || !onReorder) { setDragId(null); setDragOverId(null); return; }
    const ids = sorted.map((t) => t.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    onReorder(ids);
    setDragId(null);
    setDragOverId(null);
  };

  return (
    <div className="flex items-center gap-0.5 bg-white px-4 py-1 border-b border-edge overflow-x-auto scrollbar-thin">
      {sorted.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isEditing = editingId === tab.id;
        const isDragOver = dragOverId === tab.id && dragId !== tab.id;

        return (
          <div
            key={tab.id}
            draggable={!readOnly && !isEditing}
            onDragStart={() => handleDragStart(tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDragLeave={() => setDragOverId(null)}
            onDrop={() => handleDrop(tab.id)}
            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            className={`
              group relative flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer
              transition-colors select-none shrink-0
              ${isActive
                ? 'text-teal border-b-2 border-teal bg-teal/5'
                : 'text-muted hover:text-ink hover:bg-surface border-b-2 border-transparent'}
              ${isDragOver ? 'ring-1 ring-teal/40' : ''}
              ${dragId === tab.id ? 'opacity-50' : ''}
            `}
            onClick={() => { if (!isEditing) onSwitch(tab.id); }}
          >
            {!readOnly && (
              <GripVertical
                size={10}
                className="text-faint opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0"
              />
            )}

            {isEditing ? (
              <input
                ref={inputRef}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => commitRename(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(tab.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border-none outline-none text-xs font-medium text-ink w-24 min-w-0"
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  if (readOnly) return;
                  e.stopPropagation();
                  setEditingId(tab.id);
                  setEditDraft(tab.name);
                }}
                className="truncate max-w-[160px]"
              >
                {tab.name}
              </span>
            )}

            {!readOnly && onDelete && tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
                className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center text-faint hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0"
                title="Delete tab"
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}

      {!readOnly && onCreate && (
        <button
          onClick={() => onCreate()}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-teal hover:bg-teal/5 rounded-lg transition-colors shrink-0"
          title="Add tab"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
