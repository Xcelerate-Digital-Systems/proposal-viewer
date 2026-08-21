'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { NodeResizer, useStore, type NodeProps } from '@xyflow/react';
import { Lock, Unlock } from 'lucide-react';
import { sectionPalette, type FunnelBoardSection } from '@/lib/types/funnel';

export interface SectionNodeData extends Record<string, unknown> {
  section: FunnelBoardSection;
  readOnly?: boolean;
  onRename?: (id: string, label: string) => void;
  onToggleLock?: () => void;
}

const LABEL_LEGIBLE_ZOOM = 0.75;

function SectionNodeComponent({ data, selected, draggable }: NodeProps) {
  const { section, readOnly, onRename, onToggleLock } = data as SectionNodeData;
  const isLocked = draggable === false;
  const palette = sectionPalette(section.color);

  const zoom = useStore((s) => s.transform[2]);
  const labelScale = zoom < LABEL_LEGIBLE_ZOOM
    ? Math.min(LABEL_LEGIBLE_ZOOM / Math.max(zoom, 0.08), 6)
    : 1;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(section.label); }, [section.label]);
  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim() || 'Section';
    if (next !== section.label) onRename?.(section.id, next);
  };

  return (
    <div
      className="w-full h-full rounded-2xl"
      style={{
        backgroundColor: palette.fill,
        border: `2px dashed ${palette.border}`,
        boxShadow: selected ? `0 0 0 2px ${palette.border}` : undefined,
      }}
    >
      {!readOnly && (
        <NodeResizer
          isVisible={!!selected}
          minWidth={200}
          minHeight={160}
          lineStyle={{ borderColor: palette.border }}
          handleClassName="!w-2.5 !h-2.5 !bg-white !rounded-sm"
          handleStyle={{ border: `2px solid ${palette.text}` }}
        />
      )}

      <div
        className="absolute left-3 select-none flex items-end gap-1.5"
        style={{
          bottom: '100%',
          marginBottom: 6,
          transform: `scale(${labelScale})`,
          transformOrigin: 'bottom left',
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { setDraft(section.label); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold bg-white border rounded px-1.5 py-0.5 outline-none"
            style={{ color: palette.text, borderColor: palette.border }}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditing(true); }}
            className="text-xs font-semibold whitespace-nowrap"
            style={{ color: palette.text }}
            title={readOnly ? section.label : 'Double-click to rename'}
          >
            {section.label}
          </span>
        )}
        {!readOnly && onToggleLock && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
            className="flex items-center justify-center w-5 h-5 rounded bg-white/80 hover:bg-white border shadow-sm transition-colors"
            style={{ borderColor: palette.border, color: palette.text }}
            title={isLocked ? 'Unlock section (allow dragging)' : 'Lock section (prevent accidental drags)'}
          >
            {isLocked ? <Lock size={11} strokeWidth={2.5} /> : <Unlock size={11} strokeWidth={2.5} />}
          </button>
        )}
      </div>
    </div>
  );
}

const SectionNode = memo(SectionNodeComponent);
SectionNode.displayName = 'SectionNode';
export default SectionNode;
