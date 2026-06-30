'use client';

import { useMemo, useState, useEffect } from 'react';
import type { FeedbackBoardShape, FeedbackWaitUnit } from '@/lib/supabase';
import {
  parseWaitContent,
  serializeWaitContent,
  formatWaitLabel,
  WAIT_UNITS,
} from './shape-parsers';
import type { FeedbackWaitContent } from '@/lib/supabase';
import {
  Clock,
  DIAMOND_NODE_W,
  DIAMOND_NODE_H,
  DIAMOND_LABEL_GAP,
  DIAMOND_LABEL_BELOW,
  diamondColorOverride,
} from './diamond-config';
import { DiamondHandles } from './DiamondHandles';
import { DiamondVisual } from './DiamondVisual';

const WAIT_COLOR = '#8B5CF6';

export function WaitDiamond({
  shape, selected, readOnly, onUpdateContent,
}: {
  shape: FeedbackBoardShape;
  selected: boolean;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
}) {
  const content = useMemo(() => parseWaitContent(shape.content), [shape.content]);
  const [editing, setEditing] = useState(false);
  const [duration, setDuration] = useState(content.duration);
  const [unit, setUnit] = useState<FeedbackWaitUnit>(content.unit);
  const [labelDraft, setLabelDraft] = useState(content.label ?? '');

  useEffect(() => {
    setDuration(content.duration);
    setUnit(content.unit);
    setLabelDraft(content.label ?? '');
  }, [content.duration, content.unit, content.label]);

  const commit = () => {
    setEditing(false);
    const safeDuration = Math.min(Math.max(1, Math.round(duration)), 9999);
    const next: FeedbackWaitContent = {
      duration: safeDuration,
      unit,
      label: labelDraft.trim() || null,
    };
    if (
      next.duration !== content.duration ||
      next.unit !== content.unit ||
      (next.label ?? null) !== (content.label ?? null)
    ) {
      onUpdateContent?.(shape.id, serializeWaitContent(next));
    }
  };

  const labelText = content.label?.trim() || `Wait ${formatWaitLabel(content)}`;

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width: DIAMOND_NODE_W, height: DIAMOND_NODE_H }}
      onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditing(true); }}
    >
      <DiamondHandles readOnly={readOnly} />

      <DiamondVisual color={diamondColorOverride(shape) || WAIT_COLOR} Icon={Clock} selected={selected} />

      <div style={{ height: DIAMOND_LABEL_GAP }} aria-hidden />

      <div className="flex items-start justify-center pt-1 px-1" style={{ height: DIAMOND_LABEL_BELOW, width: 320 }}>
        {editing && !readOnly ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              min={1}
              max={9999}
              autoFocus
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDuration(content.duration); setUnit(content.unit); setLabelDraft(content.label ?? ''); setEditing(false); }
              }}
              className="w-14 text-center px-2 py-1.5 rounded-lg border border-edge bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as FeedbackWaitUnit)}
              onBlur={commit}
              className="px-2 py-1.5 rounded-lg border border-edge bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            >
              {WAIT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
              placeholder="Label"
              className="w-32 px-2.5 py-1.5 rounded-lg border border-edge bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
          </div>
        ) : (
          <span className="block text-detail text-ink/80 text-center leading-tight whitespace-nowrap">
            {labelText}
          </span>
        )}
      </div>
    </div>
  );
}
