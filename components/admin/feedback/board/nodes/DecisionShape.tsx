'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { FeedbackBoardShape, FeedbackDecisionBranch, FeedbackDecisionBranchSide } from '@/lib/supabase';
import {
  parseDecisionContent,
  serializeDecisionContent,
  DEFAULT_DECISION_CONTENT,
  ALL_SIDES,
  emptyBranchForSide,
  BRANCH_PALETTE,
  paletteEntry,
} from './shape-parsers';
import { diamondColorOverride } from './diamond-config';

/* ─── Decision-specific layout constants ─────────────────────────── */

const DECISION_DIAMOND_BOX = 42;
const DECISION_PILL_SLOT = 80;
const DECISION_LABEL_GAP = 8;
const DECISION_LABEL_BELOW = 22;
const DECISION_NODE_W = DECISION_PILL_SLOT * 2 + DECISION_DIAMOND_BOX;
const DECISION_NODE_H = DECISION_PILL_SLOT * 2 + DECISION_DIAMOND_BOX + DECISION_LABEL_GAP + DECISION_LABEL_BELOW;

/** Map our per-branch side to the React Flow Position enum for edge routing. */
function rfPosition(side: FeedbackDecisionBranchSide): Position {
  if (side === 'top') return Position.Top;
  if (side === 'right') return Position.Right;
  if (side === 'bottom') return Position.Bottom;
  return Position.Left;
}

export function DecisionShape({
  shape, selected, readOnly, onUpdateContent,
}: {
  shape: FeedbackBoardShape;
  selected: boolean;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
}) {
  const content = useMemo(() => parseDecisionContent(shape.content), [shape.content]);

  const [editingQuestion, setEditingQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState(content.question);
  const [editingSide, setEditingSide] = useState<FeedbackDecisionBranchSide | null>(null);
  const [branchDraft, setBranchDraft] = useState('');
  const [colorPickerSide, setColorPickerSide] = useState<FeedbackDecisionBranchSide | null>(null);

  useEffect(() => { setQuestionDraft(content.question); }, [content.question]);

  const commit = useCallback(
    (next: import('@/lib/supabase').FeedbackDecisionContent) => {
      onUpdateContent?.(shape.id, serializeDecisionContent(next));
    },
    [shape.id, onUpdateContent]
  );

  const updateBranchBySide = (side: FeedbackDecisionBranchSide, patch: Partial<FeedbackDecisionBranch>) => {
    commit({
      question: content.question,
      branches: content.branches.map((b) => (b.side === side ? { ...b, ...patch } : b)),
    });
  };

  const commitQuestion = () => {
    setEditingQuestion(false);
    const trimmed = questionDraft.trim();
    if (trimmed !== content.question) {
      commit({ question: trimmed || DEFAULT_DECISION_CONTENT.question, branches: content.branches });
    }
  };

  const startEditBranch = (side: FeedbackDecisionBranchSide, current: string) => {
    if (readOnly) return;
    setEditingSide(side);
    setBranchDraft(current);
  };
  const commitBranch = () => {
    if (!editingSide) return;
    updateBranchBySide(editingSide, { label: branchDraft.trim() });
    setEditingSide(null);
  };

  const bySide: Record<FeedbackDecisionBranchSide, FeedbackDecisionBranch> = {
    top: content.branches.find((b) => b.side === 'top') ?? emptyBranchForSide('top'),
    right: content.branches.find((b) => b.side === 'right') ?? emptyBranchForSide('right'),
    bottom: content.branches.find((b) => b.side === 'bottom') ?? emptyBranchForSide('bottom'),
    left: content.branches.find((b) => b.side === 'left') ?? emptyBranchForSide('left'),
  };

  const handleDotClass = '!w-3 !h-3 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

  const positionFor: Record<FeedbackDecisionBranchSide, Position> = {
    top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left,
  };

  const renderHandle = (side: FeedbackDecisionBranchSide) => (
    <div className="relative w-3 h-3 shrink-0">
      <Handle
        id={side}
        type="source"
        position={positionFor[side]}
        isConnectable={!readOnly}
        className={handleDotClass}
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );

  const renderPill = (side: FeedbackDecisionBranchSide) => {
    const b = bySide[side];
    const pal = paletteEntry(b.color);
    const isEditing = editingSide === side;
    const showColors = colorPickerSide === side;
    return (
      <div className="relative group" style={{ isolation: 'isolate' }}>
        <div
          className="nodrag px-2 py-0.5 rounded-full border-2 font-semibold text-detail leading-tight whitespace-nowrap shadow-sm select-none min-w-[40px] text-center cursor-text"
          style={{ background: pal.fill, borderColor: pal.border, color: pal.text }}
          onDoubleClick={(e) => { e.stopPropagation(); startEditBranch(side, b.label); }}
        >
          {isEditing && !readOnly ? (
            <input
              autoFocus
              value={branchDraft}
              onChange={(e) => setBranchDraft(e.target.value)}
              onBlur={commitBranch}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setEditingSide(null); }
                if (e.key === 'Enter') { e.preventDefault(); commitBranch(); }
              }}
              size={Math.max(3, branchDraft.length || 4)}
              className="bg-transparent outline-none font-semibold text-detail text-center"
              style={{ color: pal.text, minWidth: 32 }}
            />
          ) : (
            <span className={b.label ? '' : 'opacity-50'}>{b.label || '–'}</span>
          )}
        </div>

        {!readOnly && (
          <div className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-1 z-[3]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startEditBranch(side, b.label); }}
              className="w-4 h-4 rounded-full bg-white border border-edge flex items-center justify-center text-ink/70 hover:text-ink shadow-sm text-2xs font-bold"
              title="Rename"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setColorPickerSide(showColors ? null : side); }}
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ background: pal.border }}
              title="Change color"
            />
          </div>
        )}

        {!readOnly && showColors && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setColorPickerSide(null)} />
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20 bg-white rounded-lg border border-edge shadow-lg p-1.5 flex gap-1">
              {BRANCH_PALETTE.map((p) => (
                <button
                  key={p.fill}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateBranchBySide(side, { color: p.fill });
                    setColorPickerSide(null);
                  }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                    b.color === p.fill ? 'border-ink' : 'border-white'
                  }`}
                  style={{ background: p.fill }}
                  title={p.label}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const diamondSize = DECISION_DIAMOND_BOX;
  return (
    <div
      className={`relative ${selected ? 'ring-2 ring-teal/30 rounded-2xl' : ''}`}
      style={{ width: DECISION_NODE_W, height: DECISION_NODE_H }}
    >
      <div
        className="grid"
        style={{
          width: DECISION_NODE_W,
          height: DECISION_PILL_SLOT * 2 + diamondSize,
          gridTemplateColumns: `${DECISION_PILL_SLOT}px ${diamondSize}px ${DECISION_PILL_SLOT}px`,
          gridTemplateRows: `${DECISION_PILL_SLOT}px ${diamondSize}px ${DECISION_PILL_SLOT}px`,
        }}
      >
        <div />
        <div className="flex flex-col items-center justify-end gap-1 pb-1">
          {renderHandle('top')}
          {renderPill('top')}
        </div>
        <div />

        <div className="flex items-center justify-end gap-1 pr-1">
          {renderHandle('left')}
          {renderPill('left')}
        </div>

        <div
          className="relative"
          style={{ width: diamondSize, height: diamondSize }}
          onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditingQuestion(true); }}
        >
          <svg width={diamondSize} height={diamondSize} className="absolute inset-0 overflow-visible" aria-hidden="true">
            <polygon
              points={`${diamondSize / 2},0 ${diamondSize},${diamondSize / 2} ${diamondSize / 2},${diamondSize} 0,${diamondSize / 2}`}
              fill={diamondColorOverride(shape) || '#EAB308'}
              stroke={selected ? '#017C87' : 'none'}
              strokeWidth={selected ? 2 : 0}
              style={{ filter: 'drop-shadow(0 3px 8px rgba(20,20,40,0.18))' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
            <GitBranch size={16} strokeWidth={2} />
          </div>
        </div>

        <div className="flex items-center gap-1 pl-1">
          {renderPill('right')}
          {renderHandle('right')}
        </div>

        <div />
        <div className="flex flex-col items-center justify-start gap-1 pt-1">
          {renderPill('bottom')}
          {renderHandle('bottom')}
        </div>
        <div />
      </div>

      <div style={{ height: DECISION_LABEL_GAP }} aria-hidden />
      <div
        className="flex items-start justify-center px-1"
        style={{ height: DECISION_LABEL_BELOW }}
        onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditingQuestion(true); }}
      >
        {editingQuestion && !readOnly ? (
          <input
            type="text"
            autoFocus
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            onBlur={commitQuestion}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setQuestionDraft(content.question); setEditingQuestion(false); }
              if (e.key === 'Enter') { e.preventDefault(); commitQuestion(); }
            }}
            className="px-2 py-0.5 rounded border border-edge bg-white text-detail text-ink text-center outline-none focus:border-teal"
            style={{ width: 180 }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="block text-detail text-ink/80 text-center leading-tight whitespace-nowrap truncate" style={{ maxWidth: 200 }}>
            {content.question || (!readOnly && <span className="opacity-40">Decision?</span>)}
          </span>
        )}
      </div>
    </div>
  );
}
