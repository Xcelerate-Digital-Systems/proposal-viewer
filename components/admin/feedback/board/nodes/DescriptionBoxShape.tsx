'use client';

import { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { FeedbackBoardShape } from '@/lib/supabase';

export type DescriptionBoxData = {
  title: string;
  body: string;
};

export function parseDescriptionBoxContent(content: string | null): DescriptionBoxData {
  if (!content) return { title: '', body: '' };
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && typeof parsed.title === 'string') return parsed;
    } catch { /* plain text fallback */ }
  }
  return { title: content, body: '' };
}

export function serializeDescriptionBoxContent(data: DescriptionBoxData): string {
  return JSON.stringify(data);
}

const BOX_W = 260;
const MIN_H = 80;

const HANDLE_BASE =
  '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

export function DescriptionBoxShape({
  shape, selected, readOnly, onUpdateContent,
}: {
  shape: FeedbackBoardShape;
  selected: boolean;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
}) {
  const data = parseDescriptionBoxContent(shape.content);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [draftTitle, setDraftTitle] = useState(data.title);
  const [draftBody, setDraftBody] = useState(data.body);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const parsed = parseDescriptionBoxContent(shape.content);
    setDraftTitle(parsed.title);
    setDraftBody(parsed.body);
  }, [shape.content]);

  useEffect(() => {
    if (editingTitle) { titleRef.current?.focus(); titleRef.current?.select(); }
  }, [editingTitle]);

  useEffect(() => {
    if (editingBody) { bodyRef.current?.focus(); }
  }, [editingBody]);

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed !== data.title) {
      onUpdateContent?.(shape.id, serializeDescriptionBoxContent({ ...data, title: trimmed }));
    }
  };

  const commitBody = () => {
    setEditingBody(false);
    const trimmed = draftBody.trim();
    if (trimmed !== data.body) {
      onUpdateContent?.(shape.id, serializeDescriptionBoxContent({ ...data, body: trimmed }));
    }
  };

  const hasTitle = !!data.title;
  const hasBody = !!data.body;
  const isEmpty = !hasTitle && !hasBody;

  const boxW = shape.width ?? BOX_W;
  const boxH = shape.height ?? undefined;

  return (
    <div
      className={`relative transition-shadow ${
        selected ? 'ring-2 ring-teal/40 ring-offset-2 ring-offset-white' : ''
      }`}
      style={{ width: boxW, minHeight: MIN_H, height: boxH }}
    >
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={160}
          minHeight={MIN_H}
          lineClassName="!border-teal/30"
          handleClassName="!w-2.5 !h-2.5 !bg-white !rounded-sm"
          handleStyle={{ border: '2px solid #017C87' }}
        />
      )}
      {/* Handles */}
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_BASE}
        style={{ top: -5 }} isConnectable={!readOnly} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_BASE}
        style={{ right: -5, top: '50%' }} isConnectable={!readOnly} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_BASE}
        style={{ bottom: -5 }} isConnectable={!readOnly} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_BASE}
        style={{ left: -5, top: '50%' }} isConnectable={!readOnly} />

      {/* Card */}
      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-edge/60 overflow-hidden">
        {/* Title bar */}
        <div className="px-4 py-2.5 border-b border-edge/40 bg-surface/30">
          {editingTitle && !readOnly ? (
            <input
              ref={titleRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
                if (e.key === 'Escape') { setDraftTitle(data.title); setEditingTitle(false); }
              }}
              placeholder="Title"
              className="w-full text-sm font-semibold text-ink bg-transparent border-none outline-none"
            />
          ) : (
            <div
              onDoubleClick={() => !readOnly && setEditingTitle(true)}
              className="text-sm font-semibold text-ink min-h-[20px] cursor-text"
            >
              {data.title || (!readOnly && <span className="text-muted/50 font-normal">Double-click to add title</span>)}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {editingBody && !readOnly ? (
            <textarea
              ref={bodyRef}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              onBlur={commitBody}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setDraftBody(data.body); setEditingBody(false); }
              }}
              placeholder="Add a description…"
              className="w-full text-xs text-ink/80 leading-relaxed bg-transparent border-none outline-none resize-none min-h-[40px]"
              rows={3}
            />
          ) : (
            <div
              onDoubleClick={() => !readOnly && setEditingBody(true)}
              className="text-xs text-ink/70 leading-relaxed whitespace-pre-wrap min-h-[20px] cursor-text"
            >
              {data.body || (!readOnly && (
                <span className="text-muted/40">Double-click to add description</span>
              ))}
              {readOnly && isEmpty && (
                <span className="text-muted/40 italic">No description</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
