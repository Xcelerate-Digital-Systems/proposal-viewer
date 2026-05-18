'use client';

import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Clock, Phone, CalendarDays, Zap, Flag,
  MousePointerClick, FileText, PlayCircle, ChevronsDown,
  ShoppingCart, ShoppingBag, BellRing, Sparkles,
  MessageSquare, Mail, Bell, Sheet,
  Eye, Timer, LogOut, LogIn, Undo2, Download, Share2, Webhook,
  ClipboardCheck, CalendarCheck, Trophy, Target, Crown, MapPin, Send,
  Star, Gift, GitBranch,
  type LucideIcon,
} from 'lucide-react';
import type { FeedbackBoardShape, FeedbackDecisionBranch, FeedbackDecisionBranchSide, FeedbackDecisionContent, FeedbackWaitContent, FeedbackWaitUnit, FeedbackActionContent } from '@/lib/supabase';
import { NODE_FRAME_W, NODE_FRAME_H } from './nodeConfig';

const ARROW_HEAD = 12;
const ARROW_ANGLE = Math.PI / 7;

export interface ShapeNodeData extends Record<string, unknown> {
  shape: FeedbackBoardShape;
  readOnly?: boolean;
  onUpdateContent?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}

function ShapeNodeComponent({ data, selected }: NodeProps) {
  const { shape, readOnly, onUpdateContent } = data as ShapeNodeData;

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

  // Wait shape — Funnelytics-style delay diamond with duration popover
  if (shape.shape_type === 'wait') {
    return (
      <WaitDiamond
        shape={shape}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  // Event + action diamonds — single Funnelytics-style diamond shell shared
  // between the older action types (Call / Meeting / Automation / Goal) and
  // the newer event nodes (Button click, Form submit, Video play, …). Content
  // is just a label string; each type contributes its own color + icon.
  if (DIAMOND_TYPES.has(shape.shape_type)) {
    return (
      <EventDiamond
        shape={shape}
        diamondType={shape.shape_type as DiamondType}
        selected={!!selected}
        readOnly={readOnly}
        onUpdateContent={onUpdateContent}
      />
    );
  }

  // Clean SVG primitives — no rough/sketchy rendering. Funnelytics-style.
  const w = shape.width ?? 0;
  const h = shape.height ?? 0;
  const endX = shape.end_x ?? 0;
  const endY = shape.end_y ?? 0;
  const color = selected ? '#017C87' : shape.color;
  const strokeWidth = shape.stroke_width + (selected ? 0.6 : 0);
  const dashArray = shape.dashed ? '8 4' : undefined;

  if (shape.shape_type === 'rectangle') {
    const pad = strokeWidth;
    const svgWidth = Math.max(w, 4) + pad * 2;
    const svgHeight = Math.max(h, 4) + pad * 2;
    return (
      <div
        style={{ position: 'relative', width: svgWidth, height: svgHeight, marginLeft: -pad, marginTop: -pad }}
        className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <rect
            x={pad}
            y={pad}
            width={w}
            height={h}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            rx={2}
            ry={2}
          />
        </svg>
      </div>
    );
  }

  if (shape.shape_type === 'ellipse') {
    const pad = strokeWidth;
    const svgWidth = Math.max(w, 4) + pad * 2;
    const svgHeight = Math.max(h, 4) + pad * 2;
    return (
      <div
        style={{ position: 'relative', width: svgWidth, height: svgHeight, marginLeft: -pad, marginTop: -pad }}
        className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <ellipse
            cx={pad + w / 2}
            cy={pad + h / 2}
            rx={w / 2}
            ry={h / 2}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
          />
        </svg>
      </div>
    );
  }

  if (shape.shape_type === 'arrow' || shape.shape_type === 'line') {
    const dx = endX;
    const dy = endY;
    const minX = Math.min(0, dx);
    const minY = Math.min(0, dy);
    const maxX = Math.max(0, dx);
    const maxY = Math.max(0, dy);
    const pad = Math.max(strokeWidth * 2, ARROW_HEAD + 4);
    const svgWidth = (maxX - minX) + pad * 2;
    const svgHeight = (maxY - minY) + pad * 2;
    const offsetX = pad - minX;
    const offsetY = pad - minY;
    const x1 = offsetX;
    const y1 = offsetY;
    const x2 = offsetX + dx;
    const y2 = offsetY + dy;

    let arrowHeadD = '';
    if (shape.shape_type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const a1 = angle + Math.PI - ARROW_ANGLE;
      const a2 = angle + Math.PI + ARROW_ANGLE;
      const p1x = x2 + Math.cos(a1) * ARROW_HEAD;
      const p1y = y2 + Math.sin(a1) * ARROW_HEAD;
      const p2x = x2 + Math.cos(a2) * ARROW_HEAD;
      const p2y = y2 + Math.sin(a2) * ARROW_HEAD;
      arrowHeadD = `M ${p1x} ${p1y} L ${x2} ${y2} L ${p2x} ${p2y}`;
    }

    return (
      <div
        style={{
          position: 'relative',
          width: svgWidth,
          height: svgHeight,
          marginLeft: -(pad + Math.min(0, endX)),
          marginTop: -(pad + Math.min(0, endY)),
        }}
        className={selected ? 'ring-2 ring-teal/30 rounded-sm' : ''}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeLinecap="round"
          />
          {arrowHeadD && (
            <path
              d={arrowHeadD}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    );
  }

  return null;
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

// Compact decision node — tiny diamond + GitBranch icon, question text as a
// label below, 4 branch pills on each side. Matches the EventDiamond visual
// language so decision reads as just another flow shape.
const DECISION_DIAMOND_BOX = 42;
const DECISION_PILL_SLOT = 80;
const DECISION_LABEL_GAP = 8;
const DECISION_LABEL_BELOW = 22;
const DECISION_NODE_W = DECISION_PILL_SLOT * 2 + DECISION_DIAMOND_BOX;
const DECISION_NODE_H = DECISION_PILL_SLOT * 2 + DECISION_DIAMOND_BOX + DECISION_LABEL_GAP + DECISION_LABEL_BELOW;
// Legacy constants retained so any other place in the file that still
// references them keeps compiling — only the JSX render path was rewritten.
const DIAMOND = 112;
const DIAMOND_PAD = 6;
const DIAMOND_BOX = DIAMOND + DIAMOND_PAD * 2;
const DECISION_SIDE_SLOT = (NODE_FRAME_W - DIAMOND_BOX) / 2;
void DIAMOND; void DIAMOND_PAD; void DIAMOND_BOX; void DECISION_SIDE_SLOT;

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

  // Retained for downstream compatibility — the compact decision node now
  // renders an SVG polygon instead of using these stroke/point constants.
  void selected;
  const diamondPoints = (() => {
    const cx = DIAMOND_PAD + DIAMOND / 2;
    const top = DIAMOND_PAD;
    const right = DIAMOND_PAD + DIAMOND;
    const bottom = DIAMOND_PAD + DIAMOND;
    const left = DIAMOND_PAD;
    return `${cx},${top} ${right},${cx} ${cx},${bottom} ${left},${cx}`;
  })();

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
          className="nodrag px-2 py-0.5 rounded-full border-2 font-semibold text-[11px] leading-tight whitespace-nowrap shadow-sm select-none min-w-[40px] text-center cursor-text"
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
              className="bg-transparent outline-none font-semibold text-[11px] text-center"
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
              className="w-4 h-4 rounded-full bg-white border border-edge flex items-center justify-center text-ink/70 hover:text-ink shadow-sm text-[9px] font-bold"
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

  // Compact layout: tiny diamond + GitBranch icon, 4 branch pills around
  // the diamond, question text rendered as a label below — matches the
  // EventDiamond visual language.
  const diamondSize = DECISION_DIAMOND_BOX;
  return (
    <div
      className={`relative ${selected ? 'ring-2 ring-teal/30 rounded-xl' : ''}`}
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
              fill={shape.color || '#EAB308'}
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
            className="px-2 py-0.5 rounded border border-edge bg-white text-[11px] text-ink text-center outline-none focus:border-teal"
            style={{ width: 180 }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="block text-[11px] text-ink/80 text-center leading-tight whitespace-nowrap truncate" style={{ maxWidth: 200 }}>
            {content.question || (!readOnly && <span className="opacity-40">Decision?</span>)}
          </span>
        )}
      </div>
    </div>
  );
}


/* ─── Funnelytics-style flow diamonds ────────────────────────────── */

// Solid colored 45°-rotated square with an upright white icon centered.
//
// Sizes are tuned so every node type shares the same left/right connection
// Y of 100. That means a diamond, an Email/SMS circle, and a webpage card
// dropped on the same row connect with straight horizontal arrows.
//
//   circle center Y  = ICON_LABEL_AREA (56) + ICON_SIZE/2 (44)           = 100
//   diamond corner Y = DIAMOND_LABEL_AREA (79) + DIAMOND_BOX_SIZE/2 (21) = 100
//   card side Y      = CARD_SIDE_HANDLE_Y                                = 100
//
// Diamonds are deliberately small — events / logic markers shouldn't
// dominate the channel (Email/SMS) or page nodes visually.
const DIAMOND_SIDE = 30;
const DIAMOND_BOX_SIZE = 42;                       // 2 * 21 — keeps corner Y on integer px
const DIAMOND_INSET = (DIAMOND_BOX_SIZE - DIAMOND_SIDE) / 2;
const DIAMOND_LABEL_GAP = 8;                       // padding above + below label so it sits evenly between diamond bottom and bottom handle
const DIAMOND_LABEL_BELOW = 22;                    // single-line label height (was 56 — reserved unused whitespace)
const DIAMOND_NODE_W = DIAMOND_BOX_SIZE;
// Diamond sits at the TOP of the frame (no empty padding above) so vertical
// edges land right on the diamond corner. No padding below label either so
// the bottom handle sits close to the next node's connection.
const DIAMOND_NODE_H = DIAMOND_BOX_SIZE + DIAMOND_LABEL_GAP + DIAMOND_LABEL_BELOW;

type DiamondType =
  | 'call' | 'meeting' | 'automation' | 'goal'
  | 'button_click' | 'form_submit' | 'video_play' | 'scroll_depth'
  | 'purchase' | 'add_to_cart' | 'subscribe' | 'custom_event'
  | 'page_view' | 'time_on_page' | 'exit_intent' | 'refund'
  | 'download' | 'share' | 'login'
  | 'sms_notification' | 'email_notification' | 'ghl_notification'
  | 'google_sheet' | 'webhook'
  // New conversion actions
  | 'form_completed' | 'schedule_meeting' | 'deal_won'
  // New GHL integration actions
  | 'ghl_appointment' | 'ghl_order' | 'ghl_opportunity' | 'ghl_opportunity_won'
  // Field-service conversion actions
  | 'on_site_visit' | 'send_quote'
  // GHL post-sale actions
  | 'send_google_review' | 'add_to_referral_program';

interface DiamondConfig {
  color: string;
  Icon: LucideIcon;
  typeLabel: string;
  placeholder: string;
}

// Palette chosen so each node reads as a branded icon (Funnelytics-style),
// not a category-wide hue. Keep these in sync with the Funnel toolbar.
const DIAMOND_CONFIG: Record<DiamondType, DiamondConfig> = {
  // Events
  button_click: { color: '#3B82F6', Icon: MousePointerClick, typeLabel: 'Button Click', placeholder: 'Button click' },
  form_submit:  { color: '#06B6D4', Icon: FileText,          typeLabel: 'Form Submit',  placeholder: 'Form submit' },
  video_play:   { color: '#EF4444', Icon: PlayCircle,        typeLabel: 'Video Play',   placeholder: 'Video play' },
  scroll_depth: { color: '#6366F1', Icon: ChevronsDown,      typeLabel: 'Scroll',       placeholder: 'Scroll depth' },
  purchase:     { color: '#10B981', Icon: ShoppingBag,       typeLabel: 'Purchase',     placeholder: 'Purchase' },
  add_to_cart:  { color: '#F97316', Icon: ShoppingCart,      typeLabel: 'Add to Cart',  placeholder: 'Add to cart' },
  subscribe:    { color: '#EC4899', Icon: BellRing,          typeLabel: 'Subscribe',    placeholder: 'Subscribe' },
  custom_event: { color: '#64748B', Icon: Sparkles,          typeLabel: 'Event',        placeholder: 'Custom event' },
  // Existing action types — re-skinned as diamonds
  call:       { color: '#059669', Icon: Phone,        typeLabel: 'Call',       placeholder: 'Phone call' },
  meeting:    { color: '#7C3AED', Icon: CalendarDays, typeLabel: 'Meeting',    placeholder: 'Meeting' },
  automation: { color: '#F43F5E', Icon: Zap,          typeLabel: 'Automation', placeholder: 'Automation' },
  goal:       { color: '#EAB308', Icon: Flag,         typeLabel: 'Goal',       placeholder: 'Goal' },
  // Notifications + integrations
  sms_notification:   { color: '#15803D', Icon: MessageSquare, typeLabel: 'SMS Notification',     placeholder: 'SMS notification' },
  email_notification: { color: '#B91C1C', Icon: Mail,          typeLabel: 'Email Notification',   placeholder: 'Email notification' },
  ghl_notification:   { color: '#0EA5E9', Icon: Bell,          typeLabel: 'HighLevel',            placeholder: 'HighLevel notification' },
  google_sheet:       { color: '#0F9D58', Icon: Sheet,         typeLabel: 'Google Sheet',         placeholder: 'Add to Google Sheet' },
  webhook:            { color: '#7C3AED', Icon: Webhook,       typeLabel: 'Webhook',              placeholder: 'Webhook' },
  // Additional events (Funnelytics parity)
  page_view:          { color: '#0EA5E9', Icon: Eye,           typeLabel: 'Page View',            placeholder: 'Page view' },
  time_on_page:       { color: '#6366F1', Icon: Timer,         typeLabel: 'Time on Page',         placeholder: 'Time on page' },
  exit_intent:        { color: '#F43F5E', Icon: LogOut,        typeLabel: 'Exit Intent',          placeholder: 'Exit intent' },
  refund:             { color: '#DC2626', Icon: Undo2,         typeLabel: 'Refund',               placeholder: 'Refund' },
  download:           { color: '#10B981', Icon: Download,      typeLabel: 'Download',             placeholder: 'Download' },
  share:              { color: '#A855F7', Icon: Share2,        typeLabel: 'Share',                placeholder: 'Share' },
  login:              { color: '#0F766E', Icon: LogIn,         typeLabel: 'Login',                placeholder: 'Login' },
  // Conversion actions
  form_completed:     { color: '#10B981', Icon: ClipboardCheck, typeLabel: 'Form Completed',      placeholder: 'Form completed' },
  schedule_meeting:   { color: '#3B82F6', Icon: CalendarCheck,  typeLabel: 'Schedule Meeting',    placeholder: 'Schedule meeting' },
  deal_won:           { color: '#EAB308', Icon: Trophy,         typeLabel: 'Deal Won',            placeholder: 'Deal won' },
  // GHL integration actions
  ghl_appointment:    { color: '#F97316', Icon: CalendarDays,   typeLabel: 'GHL Appointment',     placeholder: 'GHL appointment' },
  ghl_order:          { color: '#F97316', Icon: ShoppingBag,    typeLabel: 'GHL Order',           placeholder: 'GHL order' },
  ghl_opportunity:    { color: '#F97316', Icon: Target,         typeLabel: 'GHL Opportunity',     placeholder: 'GHL opportunity' },
  ghl_opportunity_won:{ color: '#15803D', Icon: Crown,          typeLabel: 'GHL Opportunity Won', placeholder: 'GHL opportunity won' },
  // Field-service conversion actions
  on_site_visit:      { color: '#6366F1', Icon: MapPin,          typeLabel: 'On-Site Visit',       placeholder: 'On-site visit' },
  send_quote:         { color: '#06B6D4', Icon: Send,            typeLabel: 'Send Quote',          placeholder: 'Send quote' },
  // GHL post-sale actions
  send_google_review:      { color: '#F59E0B', Icon: Star, typeLabel: 'Send Google Review',      placeholder: 'Send Google review' },
  add_to_referral_program: { color: '#EC4899', Icon: Gift, typeLabel: 'Add to Referral Program', placeholder: 'Add to referral program' },
};

const DIAMOND_TYPES = new Set<string>(Object.keys(DIAMOND_CONFIG));

const HANDLE_CLASS =
  '!w-2.5 !h-2.5 !bg-ink/70 !border-2 !border-white hover:!bg-teal transition-colors';

// React Flow places handles at the node's bounding box edges by default, but
// the diamond's corners sit at the midpoints of the box and the label sits
// below the diamond. We override `top` per-handle so each dot lands exactly
// on its diamond corner instead of the bounding box edge midpoint.
const DIAMOND_TOP_Y = 0;                                                // diamond top corner sits at frame top
const DIAMOND_MID_Y = DIAMOND_BOX_SIZE / 2;                             // left / right corners
// Generous outset on top + sides for breathing room around the diamond.
// Bottom stays tight because the label sits flush against the diamond bottom.
const DIAMOND_SIDE_OUTSET = 20;
const HANDLE_OUTSET = 8;                                                // bottom-handle distance from diamond edge

function DiamondHandles({ readOnly }: { readOnly?: boolean }) {
  // Each handle sits a few px outward from its diamond corner so the dot is
  // visibly off the shape rather than overlapping it.
  const topStyle    = { top: DIAMOND_TOP_Y - DIAMOND_SIDE_OUTSET };
  const leftStyle   = { top: DIAMOND_MID_Y, left: -DIAMOND_SIDE_OUTSET };
  const rightStyle  = { top: DIAMOND_MID_Y, right: -DIAMOND_SIDE_OUTSET };
  // Bottom handle sits just past the label — no extra gap below the label so
  // the next node's connection sits close to this one.
  const bottomStyle = { top: DIAMOND_NODE_H + HANDLE_OUTSET, bottom: 'auto' as const };
  return (
    <>
      <Handle id="top"           type="source" position={Position.Top}    className={HANDLE_CLASS} style={topStyle}    isConnectable={!readOnly} />
      <Handle id="top-source"    type="source" position={Position.Top}    className={HANDLE_CLASS} style={topStyle}    isConnectable={!readOnly} />
      <Handle id="left"          type="source" position={Position.Left}   className={HANDLE_CLASS} style={leftStyle}   isConnectable={!readOnly} />
      <Handle id="left-source"   type="source" position={Position.Left}   className={HANDLE_CLASS} style={leftStyle}   isConnectable={!readOnly} />
      <Handle id="right"         type="source" position={Position.Right}  className={HANDLE_CLASS} style={rightStyle}  isConnectable={!readOnly} />
      <Handle id="right-target"  type="source" position={Position.Right}  className={HANDLE_CLASS} style={rightStyle}  isConnectable={!readOnly} />
      <Handle id="bottom"        type="source" position={Position.Bottom} className={HANDLE_CLASS} style={bottomStyle} isConnectable={!readOnly} />
      <Handle id="bottom-target" type="source" position={Position.Bottom} className={HANDLE_CLASS} style={bottomStyle} isConnectable={!readOnly} />
    </>
  );
}

function DiamondVisual({
  color, Icon, selected,
}: { color: string; Icon: LucideIcon; selected: boolean }) {
  return (
    <div className="relative" style={{ width: DIAMOND_BOX_SIZE, height: DIAMOND_BOX_SIZE }}>
      <div
        className="absolute rounded-md shadow-[0_3px_8px_rgba(20,20,40,0.12)]"
        style={{
          top: DIAMOND_INSET,
          left: DIAMOND_INSET,
          width: DIAMOND_SIDE,
          height: DIAMOND_SIDE,
          transform: 'rotate(45deg)',
          background: color,
          outline: selected ? '2px solid #017C87' : 'none',
          outlineOffset: selected ? 2 : 0,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
        <Icon size={14} strokeWidth={2} />
      </div>
    </div>
  );
}

function EventDiamond({
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

      <DiamondVisual color={shape.color || config.color} Icon={config.Icon} selected={selected} />

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
            className="px-2.5 py-1.5 rounded-md border border-edge bg-white text-sm text-center text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            style={{ width: 220 }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="block text-[11px] text-ink/80 text-center leading-tight whitespace-nowrap">
            {labelText}
          </span>
        )}
      </div>
    </div>
  );
}

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

function formatWaitLabel(content: FeedbackWaitContent): string {
  const unitDef = WAIT_UNITS.find((u) => u.value === content.unit);
  const short = content.duration === 1 ? unitDef?.short : `${unitDef?.short}s`;
  return `${content.duration} ${short || content.unit}`;
}

const WAIT_COLOR = '#8B5CF6';

function WaitDiamond({
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

      <DiamondVisual color={shape.color || WAIT_COLOR} Icon={Clock} selected={selected} />

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
              className="w-14 text-center px-2 py-1.5 rounded-md border border-edge bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as FeedbackWaitUnit)}
              onBlur={commit}
              className="px-2 py-1.5 rounded-md border border-edge bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
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
              className="w-32 px-2.5 py-1.5 rounded-md border border-edge bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
            />
          </div>
        ) : (
          <span className="block text-[11px] text-ink/80 text-center leading-tight whitespace-nowrap">
            {labelText}
          </span>
        )}
      </div>
    </div>
  );
}

export function parseActionContent(raw: string | null | undefined): FeedbackActionContent {
  if (!raw) return { label: null };
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackActionContent>;
    return { label: typeof parsed?.label === 'string' ? parsed.label : null };
  } catch {
    // Fall back to treating stray plain-text content as the label.
    return { label: typeof raw === 'string' ? raw : null };
  }
}

export function serializeActionContent(content: FeedbackActionContent): string {
  return JSON.stringify(content);
}


const ShapeNode = memo(ShapeNodeComponent);
ShapeNode.displayName = 'ShapeNode';

export default ShapeNode;
