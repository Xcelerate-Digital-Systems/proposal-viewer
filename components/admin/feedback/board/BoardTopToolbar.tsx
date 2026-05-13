'use client';

import { useEffect, useState } from 'react';
import {
  MousePointer2, Square, Circle, MoveRight, Minus, Type, StickyNote, Diamond, Clock, Phone, CalendarDays, Zap, Flag, Workflow, X,
  MousePointerClick, FileText, PlayCircle, ChevronsDown, ShoppingCart, ShoppingBag, BellRing, Sparkles,
  MessageSquare, Mail, Bell, Sheet,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type BoardTool =
  | 'select' | 'sticky'
  | 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text'
  | 'decision' | 'wait'
  | 'call' | 'meeting' | 'automation' | 'goal'
  | 'button_click' | 'form_submit' | 'video_play' | 'scroll_depth'
  | 'purchase' | 'add_to_cart' | 'subscribe' | 'custom_event'
  | 'sms_notification' | 'email_notification' | 'ghl_notification' | 'google_sheet';

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

// Outbound notifications + integrations — flow-only actions that don't need
// a feedback item (no review/comments). Distinct section so they're easy to
// find next to the channel review nodes.
const NOTIFICATION_TOOLS: ToolDef[] = [
  { id: 'sms_notification',   icon: <MessageSquare size={22} strokeWidth={1.7} />, label: 'SMS Notification',   shortcut: '' },
  { id: 'email_notification', icon: <Mail          size={22} strokeWidth={1.7} />, label: 'Email Notification', shortcut: '' },
  { id: 'ghl_notification',   icon: <Bell          size={22} strokeWidth={1.7} />, label: 'GHL App Notification', shortcut: '' },
  { id: 'google_sheet',       icon: <Sheet         size={22} strokeWidth={1.7} />, label: 'Add to Google Sheet',  shortcut: '' },
];

const ALL_FLOW_TOOLS = [...FLOW_TOOLS, ...EVENT_TOOLS, ...NOTIFICATION_TOOLS];

const FLOW_TOOL_IDS = new Set<BoardTool>(ALL_FLOW_TOOLS.map((t) => t.id));

interface Props {
  activeTool: BoardTool;
  onToolSelect: (tool: BoardTool) => void;
}

export default function BoardTopToolbar({ activeTool, onToolSelect }: Props) {
  const [flowOpen, setFlowOpen] = useState(false);
  // FlowNodePicker manages its own close (backdrop click + Escape) since it
  // renders in a centered overlay rather than anchored to the toolbar rail.

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
            ? 'bg-teal text-white shadow-sm'
            : soon
            ? 'text-ink/30 cursor-not-allowed'
            : 'text-ink/80 hover:bg-surface hover:text-ink'
        }`}
        title={`${tool.label}${soon ? ' — coming soon' : ` (${tool.shortcut})`}`}
      >
        {tool.icon}
        {!soon && (
          <span
            className={`absolute bottom-1 right-1.5 text-[10px] leading-none ${
              active ? 'text-white/70' : 'text-ink/40'
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
    <div className="relative flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-edge shadow-lg px-2 py-3">
      {PRIMARY_TOOLS.map((t) => renderButton(t))}

      {/* Divider between drawing tools and the funnel-node flyout */}
      <div className="w-8 h-px bg-edge my-0.5" />

      {/* Funnel nodes flyout trigger */}
      <button
        onClick={() => setFlowOpen((v) => !v)}
        className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
          flowGroupActive || flowOpen
            ? 'bg-teal text-white shadow-sm'
            : 'text-ink/80 hover:bg-surface hover:text-ink'
        }`}
        title="Flow nodes"
        aria-expanded={flowOpen}
      >
        <Workflow size={22} strokeWidth={1.7} />
        <span
          className={`absolute bottom-1 right-1.5 text-[10px] leading-none ${
            flowGroupActive || flowOpen ? 'text-white/70' : 'text-ink/40'
          }`}
        >
          F
        </span>
      </button>

      {flowOpen && (
        <FlowNodePicker
          activeTool={activeTool}
          onPick={(id) => { onToolSelect(id); setFlowOpen(false); }}
          onClose={() => setFlowOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── Flow node picker — AgencyViz-branded centered popup ────────── */

function FlowNodePicker({
  activeTool, onPick, onClose,
}: {
  activeTool: BoardTool;
  onPick: (tool: BoardTool) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />

      <div
        className="relative w-full max-w-xl bg-white rounded-2xl border border-edge shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Flow nodes"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-edge">
          <div>
            <h3 className="text-sm font-semibold text-ink">Flow nodes</h3>
            <p className="text-xs text-muted mt-0.5">Click any tile to add it to the board.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
            type="button"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <PickerSection title="Logic" tools={FLOW_TOOLS} activeTool={activeTool} onPick={onPick} />
          <PickerSection title="Events" tools={EVENT_TOOLS} activeTool={activeTool} onPick={onPick} />
          <PickerSection title="Notifications" tools={NOTIFICATION_TOOLS} activeTool={activeTool} onPick={onPick} />
        </div>
      </div>
    </div>
  );
}

function PickerSection({
  title, tools, activeTool, onPick,
}: {
  title: string;
  tools: ToolDef[];
  activeTool: BoardTool;
  onPick: (tool: BoardTool) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-wider uppercase text-muted mb-2">{title}</div>
      <div className="grid grid-cols-4 gap-2">
        {tools.map((tool) => {
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onPick(tool.id)}
              className={`group flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all text-center ${
                active
                  ? 'bg-teal text-white border-teal shadow-sm'
                  : 'bg-white text-ink border-edge hover:border-teal/50 hover:bg-teal-tint/40'
              }`}
              title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            >
              <span className={`${active ? 'text-white' : 'text-teal'}`}>{tool.icon}</span>
              <span className="text-[11px] leading-tight">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
