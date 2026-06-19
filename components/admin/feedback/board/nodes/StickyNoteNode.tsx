'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { FeedbackBoardNote } from '@/lib/supabase';

/* ─── Color presets ────────────────────────────────────────────── */

export const NOTE_COLORS = [
  { value: '#FFF4B8', label: 'Yellow' },
  { value: '#D1F0C8', label: 'Green' },
  { value: '#C8E4FF', label: 'Blue' },
  { value: '#FFD6E0', label: 'Pink' },
  { value: '#E9D5FF', label: 'Purple' },
  { value: '#FED7AA', label: 'Orange' },
];

/* ─── Node data interface ──────────────────────────────────────── */

export interface StickyNoteNodeData extends Record<string, unknown> {
  note: FeedbackBoardNote;
  readOnly?: boolean;
  onUpdate?: (noteId: string, changes: Partial<FeedbackBoardNote>) => void;
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

  const fontSize = note.font_size || 16;
  const width = note.width || 200;
  const height = note.height || 150;

  return (
    <>
      {(() => {
        const cls = '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';
        return (
          <>
            <Handle id="left" type="source" position={Position.Left} className={`${cls} !-left-1.5`} isConnectable={!readOnly} aria-label="Connect left" />
            <Handle id="left-source" type="source" position={Position.Left} className={`${cls} !-left-1.5`} isConnectable={!readOnly} aria-hidden="true" />
            <Handle id="top" type="source" position={Position.Top} className={`${cls} !-top-1.5`} isConnectable={!readOnly} aria-label="Connect top" />
            <Handle id="top-source" type="source" position={Position.Top} className={`${cls} !-top-1.5`} isConnectable={!readOnly} aria-hidden="true" />
            <Handle id="right" type="source" position={Position.Right} className={`${cls} !-right-1.5`} isConnectable={!readOnly} aria-label="Connect right" />
            <Handle id="right-target" type="source" position={Position.Right} className={`${cls} !-right-1.5`} isConnectable={!readOnly} aria-hidden="true" />
            <Handle id="bottom" type="source" position={Position.Bottom} className={`${cls} !-bottom-1.5`} isConnectable={!readOnly} aria-label="Connect bottom" />
            <Handle id="bottom-target" type="source" position={Position.Bottom} className={`${cls} !-bottom-1.5`} isConnectable={!readOnly} aria-hidden="true" />
          </>
        );
      })()}

      <div
        className={`relative group ${
          !readOnly ? 'cursor-grab active:cursor-grabbing' : ''
        } rounded-lg shadow-md ${selected ? 'ring-2 ring-teal' : ''}`}
        style={{
          width,
          minHeight: height,
          backgroundColor: note.color || '#FFF4B8',
        }}
      >
        {/* Admin controls — hidden in readOnly */}
        {!readOnly && (
          <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {/* Color picker */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
                className="w-5 h-5 rounded-full border-2 border-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                style={{ backgroundColor: note.color || '#fef08a' }}
                title="Change color"
                aria-label="Change note color"
              />
              {showColors && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColors(false)} />
                  <div className="absolute top-full mt-1 right-0 z-50 bg-white rounded-lg shadow-lg border border-edge-strong p-1.5 flex gap-1">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={(e) => { e.stopPropagation(); handleColorChange(c.value); }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-teal/30 ${
                          note.color === c.value ? 'border-prose' : 'border-white'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                        aria-label={`${c.label} color`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleDelete}
              className="w-6 h-6 rounded-full bg-white shadow-sm border border-edge-strong flex items-center justify-center text-faint hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
              title="Delete note"
              aria-label="Delete note"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 p-4 h-full">
          {editing && !readOnly ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleBlur();
              }}
              className="w-full h-full bg-transparent border-none outline-none resize-none text-ink"
              style={{ fontSize, lineHeight: 1.4, minHeight: height - 32 }}
              placeholder="Type a note..."
            />
          ) : (
            <div
              className={`w-full h-full text-ink whitespace-pre-wrap break-words ${
                !readOnly ? 'cursor-text' : ''
              }`}
              style={{ fontSize, lineHeight: 1.4, minHeight: height - 32 }}
              onDoubleClick={() => !readOnly && setEditing(true)}
            >
              {note.content || (
                <span className="text-ink/40 italic" style={{ fontSize }}>
                  Double-click to edit...
                </span>
              )}
            </div>
          )}
        </div>
      </div>

    </>
  );
}

const StickyNoteNode = memo(StickyNoteNodeComponent);
StickyNoteNode.displayName = 'StickyNoteNode';

export default StickyNoteNode;