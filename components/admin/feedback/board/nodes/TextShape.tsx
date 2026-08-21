'use client';

import { useState, useEffect, useRef } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { FeedbackBoardShape } from '@/lib/supabase';

export type TextStyleData = {
  text: string;
  bold?: boolean;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
};

export function parseTextContent(content: string | null): TextStyleData {
  if (!content) return { text: '' };
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && typeof parsed.text === 'string') return parsed;
    } catch { /* plain text */ }
  }
  return { text: content };
}

export function serializeTextContent(data: TextStyleData): string {
  if (!data.bold && !data.bgColor && (!data.align || data.align === 'left')) return data.text;
  return JSON.stringify(data);
}

const DARK_BG = new Set(['#2B2B2B', '#043946', '#017C87', '#1e293b', '#334155', '#1f2937']);

export function TextShape({
  shape, selected, readOnly, onUpdateContent,
}: {
  shape: FeedbackBoardShape;
  selected: boolean;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
}) {
  const styleData = parseTextContent(shape.content);
  const [editing, setEditing] = useState(!shape.content);
  const [draft, setDraft] = useState(styleData.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = shape.font_size ?? 16;
  const hasBg = !!styleData.bgColor;
  const isDark = hasBg && DARK_BG.has(styleData.bgColor!);
  const textColor = isDark ? '#ffffff' : (shape.color || '#2B2B2B');

  useEffect(() => {
    const parsed = parseTextContent(shape.content);
    setDraft(parsed.text);
  }, [shape.content]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== styleData.text) {
      const next = serializeTextContent({ ...styleData, text: trimmed });
      onUpdateContent?.(shape.id, next);
    }
  };

  const align = styleData.align || 'left';
  const shapeW = shape.width ?? undefined;
  const shapeH = shape.height ?? undefined;

  if (editing && !readOnly) {
    return (
      <div
        className="rounded-xl"
        style={{
          backgroundColor: styleData.bgColor || 'transparent',
          padding: hasBg ? '12px 16px' : '4px',
          width: shapeW,
          height: shapeH,
          minWidth: 120,
          overflow: shapeW ? 'hidden' : undefined,
        }}
      >
        {!readOnly && (
          <NodeResizer
            isVisible={selected}
            minWidth={80}
            minHeight={28}
            lineClassName="!border-teal/30"
            handleClassName="!w-2.5 !h-2.5 !bg-white !rounded-sm"
            handleStyle={{ border: '2px solid #017C87' }}
          />
        )}
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(styleData.text);
              setEditing(false);
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Type something…"
          className="bg-transparent border-none outline-none resize-none min-w-[100px] min-h-[28px] w-full h-full"
          style={{
            fontSize,
            lineHeight: 1.4,
            color: textColor,
            fontWeight: styleData.bold ? 600 : 400,
            textAlign: align,
          }}
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => !readOnly && setEditing(true)}
      className={`whitespace-pre-wrap cursor-text transition-shadow ${
        selected ? 'ring-2 ring-teal/40' : ''
      } ${hasBg ? 'rounded-xl shadow-sm' : ''}`}
      style={{
        fontSize,
        lineHeight: 1.4,
        color: textColor,
        fontWeight: styleData.bold ? 600 : 400,
        textAlign: align,
        backgroundColor: styleData.bgColor || 'transparent',
        padding: hasBg ? '12px 16px' : '4px',
        width: shapeW,
        height: shapeH,
        minWidth: hasBg ? 120 : undefined,
        overflow: shapeW ? 'hidden' : undefined,
        wordBreak: shapeW ? 'break-word' : undefined,
      }}
    >
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={28}
          lineClassName="!border-teal/30"
          handleClassName="!w-2.5 !h-2.5 !bg-white !rounded-sm"
          handleStyle={{ border: '2px solid #017C87' }}
        />
      )}
      {styleData.text || (!readOnly && <span className="opacity-40">Double-click to edit</span>)}
    </div>
  );
}
