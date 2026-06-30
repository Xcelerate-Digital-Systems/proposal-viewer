'use client';

import { useMemo, useState, useEffect } from 'react';
import type { FeedbackBoardShape } from '@/lib/supabase';
import { parseActionContent, serializeActionContent } from './shape-parsers';
import {
  DIAMOND_CONFIG,
  DIAMOND_NODE_W,
  DIAMOND_NODE_H,
  DIAMOND_LABEL_GAP,
  DIAMOND_LABEL_BELOW,
  diamondColorOverride,
  type DiamondType,
} from './diamond-config';
import { DiamondHandles } from './DiamondHandles';
import { DiamondVisual } from './DiamondVisual';

export function EventDiamond({
  shape, diamondType, selected, readOnly, onUpdateContent,
}: {
  shape: FeedbackBoardShape;
  diamondType: DiamondType;
  selected: boolean;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
}) {
  const config = DIAMOND_CONFIG[diamondType];
  const content = useMemo(() => parseActionContent(shape.content), [shape.content]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content.label ?? '');

  useEffect(() => { setDraft(content.label ?? ''); }, [content.label]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== (content.label ?? '')) {
      onUpdateContent?.(shape.id, serializeActionContent({ label: next || null }));
    }
  };

  const labelText = content.label || config.placeholder;

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width: DIAMOND_NODE_W, height: DIAMOND_NODE_H }}
      onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditing(true); }}
    >
      <DiamondHandles readOnly={readOnly} />

      <DiamondVisual color={diamondColorOverride(shape) || config.color} Icon={config.Icon} selected={selected} />

      {/* Gap above label — keeps label centred between diamond bottom and
          the bottom-edge handle dot (which lives below the matching gap). */}
      <div style={{ height: DIAMOND_LABEL_GAP }} aria-hidden />

      <div className="flex items-start justify-center pt-1 px-1" style={{ height: DIAMOND_LABEL_BELOW, width: 220 }}>
        {editing && !readOnly ? (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { setDraft(content.label ?? ''); setEditing(false); }
            }}
            placeholder={config.placeholder}
            className="px-2.5 py-1.5 rounded-lg border border-edge bg-white text-sm text-center text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            style={{ width: 220 }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="block text-detail text-ink/80 text-center leading-tight whitespace-nowrap">
            {labelText}
          </span>
        )}
      </div>
    </div>
  );
}
