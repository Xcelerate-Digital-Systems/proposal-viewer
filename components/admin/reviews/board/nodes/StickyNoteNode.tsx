// components/admin/reviews/board/nodes/StickyNoteNode.tsx
'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { ReviewBoardNote } from '@/lib/supabase';

/* ─── Color presets ────────────────────────────────────────────── */

export const NOTE_COLORS = [
  { value: '#fef08a', label: 'Yellow' },
  { value: '#bbf7d0', label: 'Green' },
  { value: '#bfdbfe', label: 'Blue' },
  { value: '#fecaca', label: 'Red' },
  { value: '#e9d5ff', label: 'Purple' },
  { value: '#fed7aa', label: 'Orange' },
];

/* ─── Node data interface ──────────────────────────────────────── */

export interface StickyNoteNodeData extends Record<string, unknown> {
  note: ReviewBoardNote;
  readOnly?: boolean;
  onUpdate?: (noteId: string, changes: Partial<ReviewBoardNote>) => void;
  onDelete?: (noteId: string) => void;
}

/* ─── Component ────────────────────────────────────────────────── */

function StickyNoteNodeComponent({ data, selected }: NodeProps) {
  const { note, readOnly, onUpdate, onDelete } = data as StickyNoteNodeData;
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [showColors, setShowColors] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external changes
  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  // Auto-focus textarea when editing
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (content.trim() !== note.content) {
      onUpdate?.(note.id, { content: content.trim() });
    }
  };

  const handleColorChange = (color: string) => {
    setShowColors(false);
    onUpdate?.(note.id, { color });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(note.id);
  };

  const fontSize = note.font_size || 14;
  const width = note.width || 200;
  const height = note.height || 150;

  return (
    <>
      {/* Allow connections to/from sticky notes */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-transparent !border-0 hover:!bg-gray-400 transition-colors !-left-1"
        isConnectable={!readOnly}
      />

      <div
        className={`
          rounded-lg shadow-sm transition-all relative group
          ${selected ? 'shadow-md ring-2 ring-[#017C87]/20' : 'hover:shadow-md'}
          ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        style={{
          backgroundColor: note.color || '#fef08a',
          width,
          minHeight: height,
        }}
      >
        {/* Admin controls — hidden in readOnly */}
        {!readOnly && (
          <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {/* Color picker */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
                className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: note.color || '#fef08a' }}
                title="Change color"
              />
              {showColors && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColors(false)} />
                  <div className="absolute top-full mt-1 right-0 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 flex gap-1">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={(e) => { e.stopPropagation(); handleColorChange(c.value); }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                          note.color === c.value ? 'border-gray-600' : 'border-white'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="w-6 h-6 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
              title="Delete note"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-3 h-full">
          {editing && !readOnly ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleBlur();
              }}
              className="w-full h-full bg-transparent border-none outline-none resize-none text-gray-800"
              style={{ fontSize, lineHeight: 1.5, minHeight: height - 24 }}
              placeholder="Type a note..."
            />
          ) : (
            <div
              className={`w-full h-full text-gray-800 whitespace-pre-wrap break-words ${
                !readOnly ? 'cursor-text' : ''
              }`}
              style={{ fontSize, lineHeight: 1.5, minHeight: height - 24 }}
              onDoubleClick={() => !readOnly && setEditing(true)}
            >
              {note.content || (
                <span className="text-gray-400 italic" style={{ fontSize: fontSize - 2 }}>
                  Double-click to edit...
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-transparent !border-0 hover:!bg-gray-400 transition-colors !-right-1"
        isConnectable={!readOnly}
      />
    </>
  );
}

const StickyNoteNode = memo(StickyNoteNodeComponent);
StickyNoteNode.displayName = 'StickyNoteNode';

export default StickyNoteNode;