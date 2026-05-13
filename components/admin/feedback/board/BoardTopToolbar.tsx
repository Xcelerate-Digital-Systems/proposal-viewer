'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2, Square, Circle, MoveRight, Minus, Type, StickyNote, Diamond, Clock, Phone, CalendarDays, Zap, Flag, Workflow,
  MousePointerClick, FileText, PlayCircle, ChevronsDown, ShoppingCart, ShoppingBag, BellRing, Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type BoardTool =
  | 'select' | 'sticky'
  | 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text'
  | 'decision' | 'wait'
  | 'call' | 'meeting' | 'automation' | 'goal'
  | 'button_click' | 'form_submit' | 'video_play' | 'scroll_depth'
  | 'purchase' | 'add_to_cart' | 'subscribe' | 'custom_event';

interface ToolDef {
  id: BoardTool;
  icon: ReactNode;
  label: string;
  shortcut: string;
  comingSoon?: boolean;
}

// Core drawing/selection tools — always visible in the vertical rail.
const PRIMARY_TOOLS: ToolDef[] = [
  { id: 'select', icon: <MousePointer2 size={22} strokeWidth={1.7} />, label: 'Select', shortcut: 'V' },
  { id: 'rectangle', icon: <Square size={22} strokeWidth={1.7} />, label: 'Rectangle', shortcut: 'R' },
  { id: 'ellipse', icon: <Circle size={22} strokeWidth={1.7} />, label: 'Ellipse', shortcut: 'O' },
  { id: 'arrow', icon: <MoveRight size={22} strokeWidth={1.7} />, label: 'Arrow', shortcut: 'A' },
  { id: 'line', icon: <Minus size={22} strokeWidth={2.2} />, label: 'Line', shortcut: 'L' },
  { id: 'text', icon: <Type size={22} strokeWidth={1.7} />, label: 'Text', shortcut: 'T' },
  { id: 'sticky', icon: <StickyNote size={22} strokeWidth={1.7} />, label: 'Sticky Note', shortcut: 'N' },
];

// Funnel / flow-chart markers tucked behind a flyout so the rail stays short.
// Same keyboard shortcuts as before so muscle memory is preserved.
const FLOW_TOOLS: ToolDef[] = [
  // Logic / misc
  { id: 'decision', icon: <Diamond size={22} strokeWidth={1.7} />, label: 'Decision', shortcut: 'D' },
  { id: 'wait', icon: <Clock size={22} strokeWidth={1.7} />, label: 'Wait', shortcut: 'W' },
  { id: 'goal', icon: <Flag size={22} strokeWidth={1.7} />, label: 'Goal', shortcut: 'G' },
  { id: 'call', icon: <Phone size={22} strokeWidth={1.7} />, label: 'Call', shortcut: 'C' },
  { id: 'meeting', icon: <CalendarDays size={22} strokeWidth={1.7} />, label: 'Meeting', shortcut: 'M' },
  { id: 'automation', icon: <Zap size={22} strokeWidth={1.7} />, label: 'Automation', shortcut: 'Z' },
];

// Funnelytics-style event nodes. Same flyout, separate visual group.
const EVENT_TOOLS: ToolDef[] = [
  { id: 'button_click', icon: <MousePointerClick size={22} strokeWidth={1.7} />, label: 'Button Click', shortcut: '' },
  { id: 'form_submit',  icon: <FileText          size={22} strokeWidth={1.7} />, label: 'Form Submit',  shortcut: '' },
  { id: 'video_play',   icon: <PlayCircle        size={22} strokeWidth={1.7} />, label: 'Video Play',   shortcut: '' },
  { id: 'scroll_depth', icon: <ChevronsDown      size={22} strokeWidth={1.7} />, label: 'Scroll Depth', shortcut: '' },
  { id: 'purchase',     icon: <ShoppingBag       size={22} strokeWidth={1.7} />, label: 'Purchase',     shortcut: '' },
  { id: 'add_to_cart',  icon: <ShoppingCart      size={22} strokeWidth={1.7} />, label: 'Add to Cart',  shortcut: '' },
  { id: 'subscribe',    icon: <BellRing          size={22} strokeWidth={1.7} />, label: 'Subscribe',    shortcut: '' },
  { id: 'custom_event', icon: <Sparkles          size={22} strokeWidth={1.7} />, label: 'Custom Event', shortcut: '' },
];

const ALL_FLOW_TOOLS = [...FLOW_TOOLS, ...EVENT_TOOLS];

const FLOW_TOOL_IDS = new Set<BoardTool>(ALL_FLOW_TOOLS.map((t) => t.id));

interface Props {
  activeTool: BoardTool;
  onToolSelect: (tool: BoardTool) => void;
}

export default function BoardTopToolbar({ activeTool, onToolSelect }: Props) {
  const [flowOpen, setFlowOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the flyout on outside click / Escape so it behaves like the other
  // Miro/Funnelytics-style popovers on this board.
  useEffect(() => {
    if (!flowOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFlowOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFlowOpen(false); };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [flowOpen]);

  const flowGroupActive = FLOW_TOOL_IDS.has(activeTool);

  const renderButton = (tool: ToolDef, opts?: { onAfterSelect?: () => void }) => {
    const active = activeTool === tool.id;
    const soon = tool.comingSoon;
    return (
      <button
        key={tool.id}
        onClick={() => {
          if (soon) return;
          onToolSelect(tool.id);
          opts?.onAfterSelect?.();
        }}
        disabled={soon}
        className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
          active
            ? 'bg-teal text-white shadow-sketch'
            : soon
            ? 'text-sketch-ink/30 cursor-not-allowed'
            : 'text-sketch-ink/80 hover:bg-paper-dark hover:text-sketch-ink'
        }`}
        title={`${tool.label}${soon ? ' — coming soon' : ` (${tool.shortcut})`}`}
      >
        {tool.icon}
        {!soon && (
          <span
            className={`absolute bottom-1 right-1.5 text-[11px] font-hand leading-none ${
              active ? 'text-white/70' : 'text-sketch-ink/40'
            }`}
          >
            {tool.shortcut}
          </span>
        )}
        {soon && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
            soon
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col items-center gap-1.5 bg-paper rounded-2xl border-2 border-sketch-ink/70 shadow-sketch-lg px-2 py-3 font-hand"
    >
      {PRIMARY_TOOLS.map((t) => renderButton(t))}

      {/* Divider between drawing tools and the funnel-node flyout */}
      <div className="w-8 h-px bg-sketch-ink/15 my-0.5" />

      {/* Funnel nodes flyout trigger */}
      <button
        onClick={() => setFlowOpen((v) => !v)}
        className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
          flowGroupActive || flowOpen
            ? 'bg-teal text-white shadow-sketch'
            : 'text-sketch-ink/80 hover:bg-paper-dark hover:text-sketch-ink'
        }`}
        title="Flow nodes"
        aria-expanded={flowOpen}
      >
        <Workflow size={22} strokeWidth={1.7} />
        <span
          className={`absolute bottom-1 right-1.5 text-[11px] font-hand leading-none ${
            flowGroupActive || flowOpen ? 'text-white/70' : 'text-sketch-ink/40'
          }`}
        >
          F
        </span>
      </button>

      {flowOpen && (
        <div
          className="absolute right-full top-1/2 -translate-y-1/2 mr-2 flex flex-col items-stretch gap-1 bg-paper rounded-2xl border-2 border-sketch-ink/70 shadow-sketch-lg p-2 font-hand min-w-[180px] max-h-[80vh] overflow-y-auto"
          role="menu"
        >
          <div className="px-2 pt-0.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-sketch-ink/50">
            Logic
          </div>
          {FLOW_TOOLS.map((tool) => renderFlowMenuItem(tool, activeTool, onToolSelect, setFlowOpen))}

          <div className="mx-2 my-1 h-px bg-sketch-ink/15" />

          <div className="px-2 pt-0.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-sketch-ink/50">
            Events
          </div>
          {EVENT_TOOLS.map((tool) => renderFlowMenuItem(tool, activeTool, onToolSelect, setFlowOpen))}
        </div>
      )}
    </div>
  );
}

function renderFlowMenuItem(
  tool: ToolDef,
  activeTool: BoardTool,
  onToolSelect: (t: BoardTool) => void,
  setFlowOpen: (v: boolean) => void,
) {
  const active = activeTool === tool.id;
  return (
    <button
      key={tool.id}
      role="menuitem"
      onClick={() => { onToolSelect(tool.id); setFlowOpen(false); }}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors text-left ${
        active
          ? 'bg-teal text-white'
          : 'text-sketch-ink/80 hover:bg-paper-dark hover:text-sketch-ink'
      }`}
      title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
    >
      <span className="shrink-0">{tool.icon}</span>
      <span className="flex-1 text-sm leading-none">{tool.label}</span>
      {tool.shortcut && (
        <span className={`text-[11px] leading-none ${active ? 'text-white/70' : 'text-sketch-ink/40'}`}>
          {tool.shortcut}
        </span>
      )}
    </button>
  );
}
