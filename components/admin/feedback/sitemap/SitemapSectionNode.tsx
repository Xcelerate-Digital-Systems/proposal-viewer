'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FolderOpen, Plus, Pencil, Check, Trash2 } from 'lucide-react';
import type { FeedbackItem } from '@/lib/supabase';
import SitemapSiblingMenu, { type SiblingSide, type SiblingType } from './SitemapSiblingMenu';

export interface SitemapSectionData extends Record<string, unknown> {
  item: FeedbackItem;
  childCount: number;
  isPublic?: boolean;
  onAddChild?: (parentId: string) => void;
  onRename?: (itemId: string, title: string) => void;
  onDelete?: (itemId: string) => void;
  onAddSibling?: (itemId: string, side: SiblingSide, type: SiblingType) => void;
}

export const SECTION_W = 220;
export const SECTION_H = 48;

function SitemapSectionNodeComponent({ data, selected }: NodeProps) {
  const { item, childCount, isPublic, onAddChild, onRename, onDelete, onAddSibling } = data as SitemapSectionData;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.title) {
      onRename?.(item.id, trimmed);
    } else {
      setEditValue(item.title);
    }
    setEditing(false);
  };

  return (
    <>
      {!isPublic && (
        <>
          <Handle id="top" type="target" position={Position.Top}
            className="!w-2 !h-2 !bg-slate-400 !border-2 !border-white !-top-1" />
          <Handle id="bottom" type="source" position={Position.Bottom}
            className="!w-2 !h-2 !bg-slate-400 !border-2 !border-white !-bottom-1" />
        </>
      )}

      <div
        className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-sm transition-shadow cursor-default group ${
          selected
            ? 'border-teal ring-2 ring-teal/30 bg-teal-50'
            : 'border-slate-300 bg-slate-50 hover:shadow-md hover:border-slate-400'
        }`}
        style={{ width: SECTION_W, height: SECTION_H }}
      >
        <FolderOpen size={14} className="text-slate-500 shrink-0" />

        {editing ? (
          <form
            className="flex-1 min-w-0 flex items-center gap-1"
            onSubmit={(e) => { e.preventDefault(); commitRename(); }}
          >
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Escape') { setEditValue(item.title); setEditing(false); } }}
              className="flex-1 min-w-0 text-sm font-semibold text-slate-700 bg-transparent outline-none border-b border-teal"
            />
            <button type="submit" className="shrink-0 text-teal" onClick={(e) => e.stopPropagation()}>
              <Check size={12} />
            </button>
          </form>
        ) : (
          <span className="text-sm font-semibold text-slate-700 truncate flex-1 min-w-0">
            {item.title}
          </span>
        )}

        {childCount > 0 && !editing && (
          <span className="text-[10px] text-slate-400 shrink-0">{childCount}</span>
        )}

        {/* Rename + Delete buttons — hover */}
        {!editing && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {onRename && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className="nodrag nopan w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center shadow-sm hover:border-teal hover:text-teal"
                title="Rename section"
              >
                <Pencil size={9} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="nodrag nopan w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center shadow-sm hover:border-red-400 hover:text-red-500"
                title="Delete section"
              >
                <Trash2 size={9} />
              </button>
            )}
          </div>
        )}

        {/* Add child button — hover */}
        {onAddChild && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(item.id); }}
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-teal-hover"
            title="Add page to section"
          >
            <Plus size={10} />
          </button>
        )}

        {onAddSibling && (
          <>
            <SitemapSiblingMenu side="left" onAdd={(s, t) => onAddSibling(item.id, s, t)} />
            <SitemapSiblingMenu side="right" onAdd={(s, t) => onAddSibling(item.id, s, t)} />
          </>
        )}
      </div>
    </>
  );
}

const SitemapSectionNode = memo(SitemapSectionNodeComponent);
SitemapSectionNode.displayName = 'SitemapSectionNode';
export default SitemapSectionNode;
