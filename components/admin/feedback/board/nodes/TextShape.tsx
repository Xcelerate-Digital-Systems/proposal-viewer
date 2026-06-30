'use client';

import { useState, useEffect, useRef } from 'react';
import type { FeedbackBoardShape } from '@/lib/supabase';

export function TextShape({
  shape, selected, readOnly, onUpdateContent,
}: {
  shape: FeedbackBoardShape;
  selected: boolean;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(!shape.content); // auto-edit fresh text
  const [draft, setDraft] = useState(shape.content ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = shape.font_size ?? 16;

  useEffect(() => {
    setDraft(shape.content ?? '');
  }, [shape.content]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (shape.content ?? '').trim()) {
      onUpdateContent?.(shape.id, draft.trim());
    }
  };

  if (editing && !readOnly) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(shape.content ?? '');
            setEditing(false);
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="Type something…"
        className="bg-transparent border-none outline-none resize-none min-w-[80px] min-h-[28px] text-ink"
        style={{ fontSize, lineHeight: 1.3, color: shape.color }}
      />
    );
  }

  return (
    <div
      onDoubleClick={() => !readOnly && setEditing(true)}
      className={`whitespace-pre-wrap cursor-text px-1 ${selected ? 'ring-2 ring-teal/30' : ''}`}
      style={{ fontSize, lineHeight: 1.3, color: shape.color }}
    >
      {shape.content || (!readOnly && <span className="opacity-40">Double-click to edit</span>)}
    </div>
  );
}
