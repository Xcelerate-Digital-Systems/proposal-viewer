'use client';

import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import type { FeedbackBoardShape, FeedbackDecisionBranch, FeedbackDecisionBranchSide, FeedbackDecisionContent, FeedbackWaitContent, FeedbackWaitUnit } from '@/lib/supabase';
import { roughRect, roughLine, roughPath, roughCircle } from '@/components/feedback/sketchy/roughPath';
import { hashStringToInt } from '@/components/feedback/sketchy/seed';

const ARROW_HEAD = 14;
const ARROW_ANGLE = Math.PI / 6;

export interface ShapeNodeData extends Record<string, unknown> {
  shape: FeedbackBoardShape;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}

function ShapeNodeComponent({ data, selected }: NodeProps) {
  const { shape, readOnly, onUpdateContent } = data as ShapeNodeData;
  const seed = useMemo(() => hashStringToInt(shape.id), [shape.id]);

  // Text shape uses a simple editable div instead of rough rendering
  if (shape.shape_type === 'text') {
    return (
      <TextShape
        shape={shape}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  // Decision shape — flowchart diamond with configurable branches
  if (shape.shape_type === 'decision') {
    return (
      <DecisionShape
        shape={shape}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  // Wait shape — Funnelytics-style delay step
  if (shape.shape_type === 'wait') {
    return (
      <WaitShape
        shape={shape}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  // Compute SVG dimensions based on shape type
  const w = shape.width ?? 0;
  const h = shape.height ?? 0;
  const endX = shape.end_x ?? 0;
  const endY = shape.end_y ?? 0;

  let svgWidth: number;
  let svgHeight: number;
  let paths: { d: string; stroke: string; strokeWidth: number; fill?: string }[] = [];

  const color = selected ? '#017C87' : shape.color;
  const strokeWidth = shape.stroke_width + (selected ? 0.6 : 0);
  const baseOpts = {
    seed,
    roughness: 1.8,
    bowing: 1.5,
    stroke: color,
    strokeWidth,
    strokeLineDash: shape.dashed ? [8, 4] : undefined,
    disableMultiStroke: false,
  };

  if (shape.shape_type === 'rectangle') {
    svgWidth = Math.max(w, 4) + strokeWidth * 4;
    svgHeight = Math.max(h, 4) + strokeWidth * 4;
    const pad = strokeWidth * 2;
    paths = roughRect(pad, pad, w, h, baseOpts);
  } else if (shape.shape_type === 'ellipse') {
    svgWidth = Math.max(w, 4) + strokeWidth * 4;
    svgHeight = Math.max(h, 4) + strokeWidth * 4;
    const pad = strokeWidth * 2;
    // Use ellipse path: rough.js generator has ellipse
    paths = roughPath(
      `M ${pad + w / 2} ${pad} a ${w / 2} ${h / 2} 0 1 0 0 ${h} a ${w / 2} ${h / 2} 0 1 0 0 -${h}`,
      baseOpts
    );
  } else if (shape.shape_type === 'arrow' || shape.shape_type === 'line') {
    // For arrow/line: dx, dy = end relative to start (shape node is anchored at start = 0,0 locally)
    const dx = endX;
    const dy = endY;
    const minX = Math.min(0, dx);
    const minY = Math.min(0, dy);
    const maxX = Math.max(0, dx);
    const maxY = Math.max(0, dy);
    const pad = Math.max(strokeWidth * 2, ARROW_HEAD + 4);
    svgWidth = (maxX - minX) + pad * 2;
    svgHeight = (maxY - minY) + pad * 2;
    const offsetX = pad - minX;
    const offsetY = pad - minY;
    const x1 = offsetX;
    const y1 = offsetY;
    const x2 = offsetX + dx;
    const y2 = offsetY + dy;

    paths = roughLine(x1, y1, x2, y2, { ...baseOpts, disableMultiStroke: true });

    if (shape.shape_type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const a1 = angle + Math.PI - ARROW_ANGLE;
      const a2 = angle + Math.PI + ARROW_ANGLE;
      const arrowOpts = { ...baseOpts, seed: seed + 1, roughness: 1.1, bowing: 0.6, strokeLineDash: undefined };
      const arm1 = roughLine(x2, y2, x2 + Math.cos(a1) * ARROW_HEAD, y2 + Math.sin(a1) * ARROW_HEAD, arrowOpts);
      const arm2 = roughLine(x2, y2, x2 + Math.cos(a2) * ARROW_HEAD, y2 + Math.sin(a2) * ARROW_HEAD, arrowOpts);
      paths = [...paths, ...arm1, ...arm2];
    }
  } else {
    return null;
  }

  // Shape node visually anchors at shape's stored (x, y). We offset svg inside so the visual start is flush.
  const style: React.CSSProperties =
    shape.shape_type === 'arrow' || shape.shape_type === 'line'
      ? {
          position: 'relative',
          width: svgWidth,
          height: svgHeight,
          // negative margin so the svg padding doesn't push the anchor off
          marginLeft: -(Math.max(shape.stroke_width * 2, ARROW_HEAD + 4) + Math.min(0, endX)),
          marginTop: -(Math.max(shape.stroke_width * 2, ARROW_HEAD + 4) + Math.min(0, endY)),
        }
      : {
          position: 'relative',
          width: svgWidth,
          height: svgHeight,
          marginLeft: -strokeWidth * 2,
          marginTop: -strokeWidth * 2,
        };

  return (
    <div style={style} className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}>
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill={p.fill ?? 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}

function TextShape({
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
        className="bg-transparent border-none outline-none resize-none min-w-[80px] min-h-[28px] font-hand text-sketch-ink"
        style={{ fontSize, lineHeight: 1.3, color: shape.color }}
      />
    );
  }

  return (
    <div
      onDoubleClick={() => !readOnly && setEditing(true)}
      className={`font-hand whitespace-pre-wrap cursor-text px-1 ${selected ? 'ring-2 ring-teal/30' : ''}`}
      style={{ fontSize, lineHeight: 1.3, color: shape.color }}
    >
      {shape.content || (!readOnly && <span className="opacity-40">Double-click to edit</span>)}
    </div>
  );
}

/* ─── Decision shape — flowchart diamond with branch outputs ───── */

// First palette entry is the neutral "no colour" default — an empty pill sits
// on every side until the user chooses a colour. Distinguished from pure white
// by a subtle gray fill so the empty state is visible against the paper bg.
const NEUTRAL_PALETTE = { fill: '#F3F4F6', border: '#9CA3AF', text: '#6B7280', label: 'None' };

const BRANCH_PALETTE: { fill: string; border: string; text: string; label: string }[] = [
  NEUTRAL_PALETTE,
  { fill: '#A7F3D0', border: '#047857', text: '#064E3B', label: 'Green' },
  { fill: '#FECACA', border: '#B91C1C', text: '#7F1D1D', label: 'Red' },
  { fill: '#BFDBFE', border: '#1D4ED8', text: '#1E3A8A', label: 'Blue' },
  { fill: '#FDE68A', border: '#B45309', text: '#78350F', label: 'Yellow' },
  { fill: '#DDD6FE', border: '#6D28D9', text: '#4C1D95', label: 'Purple' },
  { fill: '#FBCFE8', border: '#BE185D', text: '#831843', label: 'Pink' },
];

function paletteEntry(color: string) {
  return BRANCH_PALETTE.find((p) => p.fill === color) || NEUTRAL_PALETTE;
}

const ALL_SIDES: FeedbackDecisionBranchSide[] = ['top', 'right', 'bottom', 'left'];

function emptyBranchForSide(side: FeedbackDecisionBranchSide): FeedbackDecisionBranch {
  return { id: side, label: '', color: NEUTRAL_PALETTE.fill, side };
}

const DEFAULT_DECISION_CONTENT: FeedbackDecisionContent = {
  question: 'Decision?',
  branches: ALL_SIDES.map(emptyBranchForSide),
};

export function parseDecisionContent(raw: string | null | undefined): FeedbackDecisionContent {
  if (!raw) return cloneDefaultDecisionContent();
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackDecisionContent>;
    const question = typeof parsed?.question === 'string' ? parsed.question : DEFAULT_DECISION_CONTENT.question;

    // Enforce exactly one branch per side. Keep the first branch we encounter
    // for each side (older content may have multiple), and fill any missing
    // sides with neutral defaults so every corner always has a slot.
    const bySide: Partial<Record<FeedbackDecisionBranchSide, FeedbackDecisionBranch>> = {};
    const incoming = Array.isArray(parsed?.branches) ? parsed.branches : [];
    for (const b of incoming) {
      if (!b || !ALL_SIDES.includes(b.side as FeedbackDecisionBranchSide)) continue;
      const side = b.side as FeedbackDecisionBranchSide;
      if (bySide[side]) continue;
      bySide[side] = {
        id: b.id || side,
        label: typeof b.label === 'string' ? b.label : '',
        color: b.color ?? NEUTRAL_PALETTE.fill,
        side,
      };
    }
    const branches = ALL_SIDES.map((side) => bySide[side] ?? emptyBranchForSide(side));
    return { question, branches };
  } catch {
    return cloneDefaultDecisionContent();
  }
}

function cloneDefaultDecisionContent(): FeedbackDecisionContent {
  return {
    question: DEFAULT_DECISION_CONTENT.question,
    branches: DEFAULT_DECISION_CONTENT.branches.map((b) => ({ ...b })),
  };
}

export function serializeDecisionContent(content: FeedbackDecisionContent): string {
  return JSON.stringify(content);
}

// Sized to roughly match the feedback item card height (252px) when branches
// are present on top/bottom. 160 diamond + 12 padding + ~40 per branch row ≈ 252.
const DIAMOND = 160;
const DIAMOND_PAD = 6;
const DIAMOND_BOX = DIAMOND + DIAMOND_PAD * 2;

/** Map our per-branch side to the React Flow Position enum for edge routing. */
function rfPosition(side: FeedbackDecisionBranchSide): Position {
  if (side === 'top') return Position.Top;
  if (side === 'right') return Position.Right;
  if (side === 'bottom') return Position.Bottom;
  return Position.Left;
}

function DecisionShape({
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
    (next: FeedbackDecisionContent) => {
      onUpdateContent?.(shape.id, serializeDecisionContent(next));
    },
    [shape.id, onUpdateContent]
  );

  const seed = useMemo(() => hashStringToInt(shape.id), [shape.id]);
  const strokeColor = selected ? '#017C87' : '#2B2B2B';
  const strokeWidth = selected ? 2.6 : 2;

  const diamondPaths = useMemo(() => {
    const cx = DIAMOND_PAD + DIAMOND / 2;
    const top = DIAMOND_PAD;
    const right = DIAMOND_PAD + DIAMOND;
    const bottom = DIAMOND_PAD + DIAMOND;
    const left = DIAMOND_PAD;
    return roughPath(
      `M ${cx} ${top} L ${right} ${cx} L ${cx} ${bottom} L ${left} ${cx} Z`,
      {
        seed,
        roughness: 1.5,
        bowing: 1.6,
        stroke: strokeColor,
        strokeWidth,
        fill: '#FDE68A',
        fillStyle: 'solid',
        disableMultiStroke: false,
      }
    );
  }, [seed, strokeColor, strokeWidth]);

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

  const handleDotClass = '!w-3 !h-3 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors';

  const positionFor: Record<FeedbackDecisionBranchSide, Position> = {
    top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left,
  };

  // The handle dot sits in its own 12×12 wrapper so React Flow's absolute
  // positioning stays bounded and the dot flows naturally between the pill
  // and the outer edge of the node.
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
          className="nodrag px-3 py-1 rounded-full border-2 font-hand font-semibold text-[12px] leading-tight whitespace-nowrap shadow-sketch select-none min-w-[52px] text-center cursor-text"
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
              className="bg-transparent outline-none font-hand font-semibold text-[12px] text-center"
              style={{ color: pal.text, minWidth: 40 }}
            />
          ) : (
            <span className={b.label ? '' : 'opacity-50'}>{b.label || 'Label'}</span>
          )}
        </div>

        {!readOnly && (
          <div className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-1 z-[3]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startEditBranch(side, b.label); }}
              className="w-4 h-4 rounded-full bg-white border border-sketch-ink/40 flex items-center justify-center text-sketch-ink/70 hover:text-sketch-ink shadow-sketch text-[9px] font-bold"
              title="Rename"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setColorPickerSide(showColors ? null : side); }}
              className="w-4 h-4 rounded-full border-2 border-white shadow-sketch"
              style={{ background: pal.border }}
              title="Change color"
            />
          </div>
        )}

        {!readOnly && showColors && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setColorPickerSide(null)} />
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20 bg-paper rounded-lg border-2 border-sketch-ink/60 shadow-sketch-lg p-1.5 flex gap-1">
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
                    b.color === p.fill ? 'border-sketch-ink' : 'border-paper'
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

  // Every side follows the same order outward from the diamond:
  //   diamond corner → pill → handle dot
  return (
    <div
      className={`relative grid ${selected ? 'ring-2 ring-teal/30 rounded-xl' : ''}`}
      style={{
        gridTemplateColumns: 'minmax(110px, auto) auto minmax(110px, auto)',
        gridTemplateRows: 'minmax(52px, auto) auto minmax(52px, auto)',
      }}
    >
      {/* Row 1: top — handle sits above pill (which sits above the diamond) */}
      <div />
      <div className="flex flex-col items-center gap-1.5 pb-1">
        {renderHandle('top')}
        {renderPill('top')}
      </div>
      <div />

      {/* Row 2: left — handle | pill | diamond | pill | handle — right */}
      <div className="flex items-center justify-end gap-1.5 pr-1">
        {renderHandle('left')}
        {renderPill('left')}
      </div>

      <div className="relative" style={{ width: DIAMOND_BOX, height: DIAMOND_BOX }}>
        <svg
          width={DIAMOND_BOX}
          height={DIAMOND_BOX}
          viewBox={`0 0 ${DIAMOND_BOX} ${DIAMOND_BOX}`}
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          {diamondPaths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill={p.fill ?? 'none'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center px-8 py-8 text-center"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!readOnly) setEditingQuestion(true);
          }}
        >
          {editingQuestion && !readOnly ? (
            <textarea
              autoFocus
              value={questionDraft}
              onChange={(e) => setQuestionDraft(e.target.value)}
              onBlur={commitQuestion}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setQuestionDraft(content.question); setEditingQuestion(false); }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitQuestion(); }
              }}
              className="w-full bg-transparent border-none outline-none resize-none font-hand text-sketch-ink text-center leading-tight"
              style={{ fontSize: 16 }}
              rows={3}
            />
          ) : (
            <span className="font-hand text-sketch-ink leading-tight" style={{ fontSize: 16 }}>
              {content.question || (!readOnly && <span className="opacity-40">Double-click</span>)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 pl-1">
        {renderPill('right')}
        {renderHandle('right')}
      </div>

      {/* Row 3: bottom — pill below diamond, handle below pill */}
      <div />
      <div className="flex flex-col items-center gap-1.5 pt-1">
        {renderPill('bottom')}
        {renderHandle('bottom')}
      </div>
      <div />
    </div>
  );
}


/* ─── Wait shape — flowchart delay step (Funnelytics-style) ──────── */

const WAIT_UNITS: { value: FeedbackWaitUnit; label: string; short: string }[] = [
  { value: 'minutes', label: 'Minutes', short: 'min' },
  { value: 'hours',   label: 'Hours',   short: 'hr' },
  { value: 'days',    label: 'Days',    short: 'day' },
  { value: 'weeks',   label: 'Weeks',   short: 'wk' },
];

const DEFAULT_WAIT_CONTENT: FeedbackWaitContent = { duration: 1, unit: 'days', label: null };

export function parseWaitContent(raw: string | null | undefined): FeedbackWaitContent {
  if (!raw) return DEFAULT_WAIT_CONTENT;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackWaitContent>;
    const unit = WAIT_UNITS.find((u) => u.value === parsed?.unit)?.value ?? DEFAULT_WAIT_CONTENT.unit;
    const duration = typeof parsed?.duration === 'number' && parsed.duration > 0
      ? Math.min(parsed.duration, 9999)
      : DEFAULT_WAIT_CONTENT.duration;
    return {
      duration,
      unit,
      label: typeof parsed?.label === 'string' ? parsed.label : null,
    };
  } catch {
    return DEFAULT_WAIT_CONTENT;
  }
}

export function serializeWaitContent(content: FeedbackWaitContent): string {
  return JSON.stringify(content);
}

// Wait renders as a small rounded square so it reads instantly as "this is
// not a content item" next to the circular email/sms/ad icons and the
// diamond decision node. Smaller footprint than the 88px item icons since
// it's a flow marker, not a content preview.
const WAIT_ICON_SIZE = 64;
const WAIT_NODE_WIDTH = 140;

function formatWaitLabel(content: FeedbackWaitContent): string {
  const unitDef = WAIT_UNITS.find((u) => u.value === content.unit);
  const short = content.duration === 1 ? unitDef?.short : `${unitDef?.short}s`;
  return `Wait ${content.duration} ${short || content.unit}`;
}

function WaitShape({
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

  const handleClass = '!w-2.5 !h-2.5 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors';

  return (
    <div className={`relative flex flex-col items-center ${selected ? 'ring-2 ring-teal/30 rounded-xl' : ''}`} style={{ width: WAIT_NODE_WIDTH }}>
      {/* Handles live on the outer node so the top handle sits above the icon
          and the bottom handle sits below the label — matching the email /
          SMS / ad icon nodes. Every handle is `type="source"` so React Flow
          always treats the drag-start as the edge source under connectionMode
          "loose" (Miro-style); `-source` / `-target` aliases preserve edges
          saved before this change. */}
      <Handle id="top"           type="source" position={Position.Top}    className={`${handleClass} !-top-1.5`} isConnectable={!readOnly} />
      <Handle id="top-source"    type="source" position={Position.Top}    className={`${handleClass} !-top-1.5`} isConnectable={!readOnly} />
      <Handle id="left"          type="source" position={Position.Left}   className={`${handleClass} !-left-1.5`} isConnectable={!readOnly} />
      <Handle id="left-source"   type="source" position={Position.Left}   className={`${handleClass} !-left-1.5`} isConnectable={!readOnly} />
      <Handle id="right"         type="source" position={Position.Right}  className={`${handleClass} !-right-1.5`} isConnectable={!readOnly} />
      <Handle id="right-target"  type="source" position={Position.Right}  className={`${handleClass} !-right-1.5`} isConnectable={!readOnly} />
      <Handle id="bottom"        type="source" position={Position.Bottom} className={`${handleClass} !-bottom-1.5`} isConnectable={!readOnly} />
      <Handle id="bottom-target" type="source" position={Position.Bottom} className={`${handleClass} !-bottom-1.5`} isConnectable={!readOnly} />

      {/* Flat filled square — deliberately skips the roughjs sketchy border
          so Wait reads as a system/flow marker distinct from the hand-drawn
          content nodes and the diamond. */}
      <div
        className={`relative rounded-lg ${selected ? 'ring-2 ring-teal/60' : ''}`}
        style={{ width: WAIT_ICON_SIZE, height: WAIT_ICON_SIZE, background: '#BFDBFE' }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-sketch-ink pointer-events-none">
          <Clock size={24} strokeWidth={1.5} />
        </div>
      </div>

      <div
        className="mt-2 text-center w-full px-1"
        onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly) setEditing(true); }}
      >
        {editing && !readOnly ? (
          <div className="flex flex-col items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 w-full">
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
                className="w-10 text-center px-1 py-0.5 rounded-md border border-sketch-ink/40 bg-paper font-hand text-sm focus:outline-none focus:border-teal"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as FeedbackWaitUnit)}
                className="flex-1 min-w-0 px-1 py-0.5 rounded-md border border-sketch-ink/40 bg-paper font-hand text-xs focus:outline-none focus:border-teal"
              >
                {WAIT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
              }}
              placeholder="Label (optional)"
              className="w-full px-1 py-0.5 rounded-md border border-sketch-ink/30 bg-paper font-hand text-[11px] focus:outline-none focus:border-teal"
            />
          </div>
        ) : (
          <>
            <h4 className="font-hand text-base text-sketch-ink truncate leading-tight">
              {formatWaitLabel(content)}
            </h4>
            <span className="text-[11px] font-medium text-sketch-ink/60 mt-0.5 block uppercase tracking-wider">
              {content.label || 'Wait'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const ShapeNode = memo(ShapeNodeComponent);
ShapeNode.displayName = 'ShapeNode';

export default ShapeNode;
