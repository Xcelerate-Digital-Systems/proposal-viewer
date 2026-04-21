'use client';

import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus, X } from 'lucide-react';
import type { FeedbackBoardShape, FeedbackDecisionBranch, FeedbackDecisionBranchSide, FeedbackDecisionContent } from '@/lib/supabase';
import { roughRect, roughLine, roughPath } from '@/components/feedback/sketchy/roughPath';
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

const BRANCH_PALETTE: { fill: string; border: string; text: string; label: string }[] = [
  { fill: '#A7F3D0', border: '#047857', text: '#064E3B', label: 'Green' },
  { fill: '#FECACA', border: '#B91C1C', text: '#7F1D1D', label: 'Red' },
  { fill: '#BFDBFE', border: '#1D4ED8', text: '#1E3A8A', label: 'Blue' },
  { fill: '#FDE68A', border: '#B45309', text: '#78350F', label: 'Yellow' },
  { fill: '#DDD6FE', border: '#6D28D9', text: '#4C1D95', label: 'Purple' },
  { fill: '#FBCFE8', border: '#BE185D', text: '#831843', label: 'Pink' },
];

function paletteEntry(color: string) {
  return BRANCH_PALETTE.find((p) => p.fill === color) || BRANCH_PALETTE[0];
}

const DEFAULT_DECISION_CONTENT: FeedbackDecisionContent = {
  question: 'Decision?',
  branches: [
    { id: 'b1', label: 'Yes', color: BRANCH_PALETTE[0].fill, side: 'right' },
    { id: 'b2', label: 'No', color: BRANCH_PALETTE[1].fill, side: 'bottom' },
  ],
};

const ALL_SIDES: FeedbackDecisionBranchSide[] = ['top', 'right', 'bottom', 'left'];

function sideFromIndex(i: number): FeedbackDecisionBranchSide {
  return ALL_SIDES[(i + 1) % 4]; // default first branch → right, then bottom, left, top
}

export function parseDecisionContent(raw: string | null | undefined): FeedbackDecisionContent {
  if (!raw) return DEFAULT_DECISION_CONTENT;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackDecisionContent>;
    if (!parsed || !Array.isArray(parsed.branches) || parsed.branches.length === 0) {
      return DEFAULT_DECISION_CONTENT;
    }
    return {
      question: typeof parsed.question === 'string' ? parsed.question : DEFAULT_DECISION_CONTENT.question,
      branches: parsed.branches.map((b, i) => ({
        id: b?.id || `b${i + 1}`,
        label: b?.label ?? '',
        color: b?.color ?? BRANCH_PALETTE[i % BRANCH_PALETTE.length].fill,
        side: b?.side && ALL_SIDES.includes(b.side) ? b.side : sideFromIndex(i),
      })),
    };
  } catch {
    return DEFAULT_DECISION_CONTENT;
  }
}

export function serializeDecisionContent(content: FeedbackDecisionContent): string {
  return JSON.stringify(content);
}

const DIAMOND = 130;
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

  // Local drafts for inline editing
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState(content.question);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchDraft, setBranchDraft] = useState('');
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

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

  const updateBranch = (id: string, patch: Partial<FeedbackDecisionBranch>) => {
    commit({
      question: content.question,
      branches: content.branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  };

  const removeBranch = (id: string) => {
    if (content.branches.length <= 1) return;
    commit({
      question: content.question,
      branches: content.branches.filter((b) => b.id !== id),
    });
  };

  const addBranchOnSide = (side: FeedbackDecisionBranchSide) => {
    const nextIndex = content.branches.length;
    const palette = BRANCH_PALETTE[nextIndex % BRANCH_PALETTE.length];
    const newId = `b${Date.now()}`;
    commit({
      question: content.question,
      branches: [...content.branches, { id: newId, label: 'Option', color: palette.fill, side }],
    });
  };

  const commitQuestion = () => {
    setEditingQuestion(false);
    const trimmed = questionDraft.trim();
    if (trimmed !== content.question) {
      commit({ question: trimmed || DEFAULT_DECISION_CONTENT.question, branches: content.branches });
    }
  };

  const startEditBranch = (b: FeedbackDecisionBranch) => {
    if (readOnly) return;
    setEditingBranchId(b.id);
    setBranchDraft(b.label);
  };

  const commitBranch = () => {
    if (!editingBranchId) return;
    updateBranch(editingBranchId, { label: branchDraft.trim() || 'Option' });
    setEditingBranchId(null);
  };

  const branchesBySide: Record<FeedbackDecisionBranchSide, FeedbackDecisionBranch[]> = {
    top: [], right: [], bottom: [], left: [],
  };
  for (const b of content.branches) branchesBySide[b.side].push(b);

  const renderBranch = (b: FeedbackDecisionBranch) => {
    const pal = paletteEntry(b.color);
    const isEditing = editingBranchId === b.id;
    const showColors = colorPickerFor === b.id;
    return (
      <div key={b.id} className="relative group">
        <div
          className="px-3 py-1 rounded-full border-2 font-hand font-semibold text-[12px] leading-tight whitespace-nowrap shadow-sketch select-none"
          style={{ background: pal.fill, borderColor: pal.border, color: pal.text }}
          onDoubleClick={(e) => { e.stopPropagation(); startEditBranch(b); }}
        >
          {isEditing && !readOnly ? (
            <input
              autoFocus
              value={branchDraft}
              onChange={(e) => setBranchDraft(e.target.value)}
              onBlur={commitBranch}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setEditingBranchId(null); }
                if (e.key === 'Enter') { e.preventDefault(); commitBranch(); }
              }}
              size={Math.max(3, branchDraft.length)}
              className="bg-transparent outline-none font-hand font-semibold text-[12px]"
              style={{ color: pal.text, minWidth: 40 }}
            />
          ) : (
            <span>{b.label || 'Option'}</span>
          )}
        </div>

        {/* Source handle sits at the outward-facing edge of the pill so edges
            leave the branch in the direction of its side. React Flow uses
            position for routing, explicit style for visual placement. */}
        <Handle
          id={`branch-${b.id}`}
          type="source"
          position={rfPosition(b.side)}
          isConnectable={!readOnly}
          style={{
            ...handleEdgeStyle(b.side),
            width: 10, height: 10,
            background: pal.border,
            border: '2px solid #FAFAFA',
            borderRadius: '50%',
          }}
        />

        {/* Admin controls: color, side cycle, remove */}
        {!readOnly && (
          <div className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-1 z-10">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setColorPickerFor(showColors ? null : b.id); }}
              className="w-4 h-4 rounded-full border-2 border-white shadow-sketch"
              style={{ background: pal.border }}
              title="Change color"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const idx = ALL_SIDES.indexOf(b.side);
                updateBranch(b.id, { side: ALL_SIDES[(idx + 1) % 4] });
              }}
              className="w-4 h-4 rounded-full bg-white border border-sketch-ink/40 flex items-center justify-center text-sketch-ink/70 hover:text-sketch-ink shadow-sketch text-[9px] font-bold"
              title="Move to next side"
            >
              ↻
            </button>
            {content.branches.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeBranch(b.id); }}
                className="w-4 h-4 rounded-full bg-white border border-sketch-ink/40 flex items-center justify-center text-sketch-ink/70 hover:text-red-600 shadow-sketch"
                title="Remove branch"
              >
                <X size={9} />
              </button>
            )}
          </div>
        )}

        {!readOnly && showColors && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setColorPickerFor(null)} />
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20 bg-paper rounded-lg border-2 border-sketch-ink/60 shadow-sketch-lg p-1.5 flex gap-1">
              {BRANCH_PALETTE.map((p) => (
                <button
                  key={p.fill}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateBranch(b.id, { color: p.fill });
                    setColorPickerFor(null);
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

  const renderAddButton = (side: FeedbackDecisionBranchSide) => {
    if (readOnly || content.branches.length >= 6) return null;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); addBranchOnSide(side); }}
        className="w-6 h-6 rounded-full bg-paper border-2 border-dashed border-sketch-ink/40 text-sketch-ink/60 hover:border-sketch-ink hover:text-sketch-ink flex items-center justify-center transition-colors"
        title={`Add branch on ${side}`}
      >
        <Plus size={12} />
      </button>
    );
  };

  // Three-column, three-row grid keeps the diamond centred while each cardinal
  // slot grows to fit its stacked branch pills without affecting the others.
  return (
    <div
      className={`relative grid ${selected ? 'ring-2 ring-teal/30 rounded-xl' : ''}`}
      style={{ gridTemplateColumns: 'minmax(80px, auto) auto minmax(80px, auto)', gridTemplateRows: 'minmax(40px, auto) auto minmax(40px, auto)' }}
    >
      {/* Input target handles on all 4 diamond corners, so connections can
          drop onto the node from any direction. Each branch owns its own
          source handle on whichever side it lives. */}
      <Handle id="top" type="target" position={Position.Top}
        className="!w-3 !h-3 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors"
        style={{ left: '50%' }} isConnectable={!readOnly} />
      <Handle id="left" type="target" position={Position.Left}
        className="!w-3 !h-3 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors"
        style={{ top: '50%' }} isConnectable={!readOnly} />
      <Handle id="right-target" type="target" position={Position.Right}
        className="!w-3 !h-3 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors"
        style={{ top: '50%' }} isConnectable={!readOnly} />
      <Handle id="bottom-target" type="target" position={Position.Bottom}
        className="!w-3 !h-3 !bg-sketch-ink/70 !border-2 !border-paper hover:!bg-teal transition-colors"
        style={{ left: '50%' }} isConnectable={!readOnly} />

      {/* ── Row 1: top branches ─────────────────────────────────── */}
      <div /> {/* spacer */}
      <div className="flex flex-wrap items-end justify-center gap-2 pb-1">
        {branchesBySide.top.map(renderBranch)}
        {renderAddButton('top')}
      </div>
      <div />

      {/* ── Row 2: left branches | diamond | right branches ─────── */}
      <div className="flex flex-col items-end justify-center gap-2 pr-1">
        {branchesBySide.left.map(renderBranch)}
        {renderAddButton('left')}
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
          className="absolute inset-0 flex items-center justify-center px-6 py-6 text-center"
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
              style={{ fontSize: 15 }}
              rows={3}
            />
          ) : (
            <span className="font-hand text-sketch-ink leading-tight" style={{ fontSize: 15 }}>
              {content.question || (!readOnly && <span className="opacity-40">Double-click</span>)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start justify-center gap-2 pl-1">
        {branchesBySide.right.map(renderBranch)}
        {renderAddButton('right')}
      </div>

      {/* ── Row 3: bottom branches ──────────────────────────────── */}
      <div />
      <div className="flex flex-wrap items-start justify-center gap-2 pt-1">
        {branchesBySide.bottom.map(renderBranch)}
        {renderAddButton('bottom')}
      </div>
      <div />
    </div>
  );
}

/** Tiny helper: position the branch's handle dot on its outward edge. */
function handleEdgeStyle(side: FeedbackDecisionBranchSide): React.CSSProperties {
  if (side === 'top')    return { top: -6, left: '50%', transform: 'translate(-50%, 0)' };
  if (side === 'bottom') return { bottom: -6, left: '50%', transform: 'translate(-50%, 0)' };
  if (side === 'left')   return { left: -6, top: '50%', transform: 'translate(0, -50%)' };
  return                        { right: -6, top: '50%', transform: 'translate(0, -50%)' };
}

const ShapeNode = memo(ShapeNodeComponent);
ShapeNode.displayName = 'ShapeNode';

export default ShapeNode;
