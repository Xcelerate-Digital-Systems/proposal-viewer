'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, ChevronLeft, Diamond, Clock, Flag, Phone, CalendarDays, Zap,
  MousePointerClick, FileText, PlayCircle, ChevronsDown, ShoppingBag, ShoppingCart,
  BellRing, Sparkles, MessageSquare, Mail, Bell, Sheet, StickyNote, PanelLeftOpen,
  Eye, Timer, LogOut, LogIn, Undo2, Download, Share2, Webhook, Plus, Upload,
  Workflow, FileBox, MousePointer2, Pencil, Square, Circle, MoveRight, Minus, Type,
  ClipboardCheck, CalendarCheck, Trophy, Target, Crown, MapPin, Send,
  Star, Gift,
  type LucideIcon,
} from 'lucide-react';
import type { FunnelStepType, FunnelShapeType } from '@/lib/supabase';
import {
  FUNNEL_STEP_DEFAULTS, FUNNEL_PALETTE_TABS,
  type PaletteItem, type PaletteGroup, type FunnelPaletteTabId,
} from '@/lib/types/funnel';
import { StepIcon } from './nodes/FunnelStepNode';
import { useToast } from '@/components/ui/Toast';

interface Props {
  onPickStep: (stepType: FunnelStepType) => void;
  onPickShape: (shapeType: FunnelShapeType) => void;
  onPickSticky: () => void;
}

const SHAPE_ICONS: Record<string, LucideIcon> = {
  diamond: Diamond, clock: Clock, flag: Flag, phone: Phone,
  'calendar-days': CalendarDays, zap: Zap,
  'mouse-pointer-click': MousePointerClick, 'file-text': FileText,
  'play-circle': PlayCircle, 'chevrons-down': ChevronsDown,
  'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart,
  'bell-ring': BellRing, sparkles: Sparkles, 'message-square': MessageSquare,
  mail: Mail, bell: Bell, sheet: Sheet, eye: Eye, timer: Timer,
  'log-out': LogOut, 'log-in': LogIn, 'undo-2': Undo2,
  download: Download, 'share-2': Share2, webhook: Webhook,
  'clipboard-check': ClipboardCheck, 'calendar-check': CalendarCheck,
  trophy: Trophy, target: Target, crown: Crown,
  'map-pin': MapPin, send: Send,
  star: Star, gift: Gift,
  square: Square, circle: Circle, 'move-right': MoveRight, minus: Minus, type: Type,
};

/** Tint per shape type — kept in lockstep with `DIAMOND_CONFIG` in
 *  feedback/board/nodes/ShapeNode.tsx so the palette tile colour matches
 *  the colour the node actually paints on the canvas. */
const SHAPE_TINTS: Record<string, string> = {
  // Conversion
  purchase: '#10B981', add_to_cart: '#F97316', subscribe: '#EC4899', goal: '#EAB308',
  form_completed: '#10B981', schedule_meeting: '#3B82F6', deal_won: '#EAB308',
  on_site_visit: '#6366F1', send_quote: '#06B6D4',
  send_google_review: '#F59E0B', add_to_referral_program: '#EC4899',
  // Engagement
  page_view: '#0EA5E9', button_click: '#3B82F6', form_submit: '#06B6D4',
  video_play: '#EF4444', scroll_depth: '#6366F1', time_on_page: '#6366F1', exit_intent: '#F43F5E',
  // Integration
  sms_notification: '#15803D', email_notification: '#B91C1C', ghl_notification: '#0EA5E9',
  webhook: '#7C3AED', google_sheet: '#0F9D58',
  call: '#059669', meeting: '#7C3AED', automation: '#F43F5E',
  ghl_appointment: '#F97316', ghl_order: '#F97316',
  ghl_opportunity: '#F97316', ghl_opportunity_won: '#15803D',
  // Custom Actions
  decision: '#B45309', wait: '#8B5CF6', refund: '#DC2626',
  download: '#10B981', share: '#A855F7', login: '#0F766E', custom_event: '#64748B',
  // Primitive drawing shapes
  rectangle: '#64748B', ellipse: '#64748B', arrow: '#64748B', line: '#64748B', text: '#64748B',
};

const TAB_ICONS: Record<FunnelPaletteTabId, LucideIcon> = {
  sources: MousePointer2,
  pages: FileBox,
  actions: Workflow,
  drawing: Pencil,
};

const PRIMITIVE_ICONS: Record<string, LucideIcon> = {
  rectangle: Square,
  ellipse: Circle,
  arrow: MoveRight,
  line: Minus,
  text: Type,
};

/** Open-by-default subgroups per tab — keeps the palette compact on first
 *  visit while making the most useful tiles immediately reachable. */
const DEFAULT_OPEN: Record<string, boolean> = {
  paid: true, search: true, social: true, other: false,
  crm_src: true, messaging_src: true,
  offline: false, othersites: false, custom_src: false,
  pages: true, offers: false, custom_pages: false,
  primitives: true, notes: true,
  conversion: true, engagement: true, integration: false,
  gohighlevel: true, messaging: true,
  custom_actions: false, custom_act: false,
};

export default function NodePalette({ onPickStep, onPickShape, onPickSticky }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<FunnelPaletteTabId>('sources');
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const toast = useToast();

  const handlePick = (item: PaletteItem) => {
    if (item.kind === 'step') onPickStep(item.stepType);
    else if (item.kind === 'shape') onPickShape(item.shapeType as FunnelShapeType);
    else if (item.kind === 'sticky') onPickSticky();
    else if (item.kind === 'upload') {
      toast.info('Custom icon upload is coming soon — file picker will be wired in the next pass.');
    }
  };

  if (collapsed) {
    return (
      <aside className="w-9 shrink-0 border-r border-edge bg-white flex flex-col items-center pt-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface transition-colors"
          title="Open palette"
        >
          <PanelLeftOpen size={16} />
        </button>
      </aside>
    );
  }

  const active = FUNNEL_PALETTE_TABS.find((t) => t.id === activeTab) ?? FUNNEL_PALETTE_TABS[0];

  return (
    <aside className="w-[320px] shrink-0 border-r border-edge bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-edge flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Add to canvas</h3>
          <p className="text-detail text-muted mt-0.5">Click or drag tiles · Right-click canvas for more</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-ink/60 hover:text-ink hover:bg-surface transition-colors shrink-0"
          title="Collapse palette"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div
        className="flex border-b border-edge shrink-0"
        role="tablist"
        onKeyDown={(e) => {
          const tabs = FUNNEL_PALETTE_TABS;
          const idx = tabs.findIndex((t) => t.id === activeTab);
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = tabs[(idx + 1) % tabs.length];
            setActiveTab(next.id);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
            setActiveTab(prev.id);
          }
        }}
      >
        {FUNNEL_PALETTE_TABS.map((t) => {
          const Icon = TAB_ICONS[t.id];
          const isActive = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-2xs font-medium transition-colors border-b-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal/30 ${
                isActive
                  ? 'border-teal text-teal bg-teal/[0.04]'
                  : 'border-transparent text-muted hover:text-ink hover:bg-surface'
              }`}
            >
              <Icon size={14} strokeWidth={1.8} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {active.groups.map((group) => (
          <PaletteSection
            key={group.key}
            group={group}
            open={!!open[group.key]}
            onToggle={() => setOpen((p) => ({ ...p, [group.key]: !p[group.key] }))}
            onPick={handlePick}
          />
        ))}
      </div>
    </aside>
  );
}

function PaletteSection({
  group, open, onToggle, onPick,
}: {
  group: PaletteGroup;
  open: boolean;
  onToggle: () => void;
  onPick: (item: PaletteItem) => void;
}) {
  const isEmpty = group.items.length === 0;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-2xs uppercase tracking-wider font-semibold text-muted hover:text-ink transition-colors mb-1.5"
      >
        <span className="flex items-center gap-1.5">
          {group.label}
          {isEmpty && <span className="text-2xs text-muted/60 normal-case font-normal tracking-normal">Coming soon</span>}
        </span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && !isEmpty && (
        <div className="grid grid-cols-3 gap-2">
          {group.items.map((item, i) => (
            <PaletteTile key={i} item={item} onClick={() => onPick(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Mime-type used to ferry a palette item from a tile drag to the canvas
 *  drop handler. The payload is JSON-stringified PaletteItem. */
export const PALETTE_DRAG_MIME = 'application/funnel-palette-item';

function PaletteTile({ item, onClick }: { item: PaletteItem; onClick: () => void }) {
  // Both click-to-add (centre of viewport) and drag-and-drop (dropped at the
  // cursor position) are supported. HTML5 drag-and-drop integrates cleanly
  // with React Flow's onDrop on the canvas wrapper.
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(PALETTE_DRAG_MIME, JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (item.kind === 'upload') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border border-dashed border-edge bg-white hover:border-teal/60 hover:bg-teal/[0.03] transition-all"
        title="Upload your own icon"
      >
        <span className="w-11 h-11 flex items-center justify-center rounded-full bg-surface text-muted group-hover:text-teal group-hover:bg-teal/10 transition-colors">
          <Plus size={20} strokeWidth={2} />
        </span>
        <span className="text-2xs text-ink/80 text-center leading-tight px-0.5 flex items-center gap-0.5">
          <Upload size={9} /> Upload
        </span>
      </button>
    );
  }

  if (item.kind === 'step') {
    const def = FUNNEL_STEP_DEFAULTS[item.stepType];
    const isPage = item.stepType.startsWith('page_');
    return (
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={onClick}
        className="group flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
        title={`Drag to canvas or click to add: ${def.label}`}
      >
        {isPage ? (
          <span className="w-10 h-12 rounded-sm bg-white border border-edge shrink-0 overflow-hidden flex flex-col pointer-events-none">
            <span className="h-1.5 bg-surface border-b border-edge/60" />
            <span className="flex-1 flex flex-col items-center justify-center gap-[2px] px-1" style={{ backgroundColor: `${def.tint}10` }}>
              <span className="h-0.5 w-6 rounded-full" style={{ backgroundColor: def.tint }} />
              <span className="h-0.5 w-5 rounded-full bg-ink/20" />
              <span className="h-1 w-6 rounded-sm mt-0.5" style={{ backgroundColor: def.tint }} />
            </span>
          </span>
        ) : (
          <span
            className="w-11 h-11 rounded-full shrink-0 pointer-events-none flex items-center justify-center"
            style={{ backgroundColor: def.tint }}
          >
            <StepIcon slug={def.icon} size={22} />
          </span>
        )}
        <span className="text-2xs text-ink/80 text-center leading-tight line-clamp-2 pointer-events-none px-0.5">
          {def.label}
        </span>
      </button>
    );
  }

  if (item.kind === 'shape') {
    const Icon = SHAPE_ICONS[item.iconName] || Diamond;
    const tint = SHAPE_TINTS[item.shapeType] || '#64748B';
    return (
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={onClick}
        className="group flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
        title={`Drag to canvas or click to add: ${item.label}`}
      >
        <span
          className="w-11 h-11 flex items-center justify-center rounded-full pointer-events-none"
          style={{ backgroundColor: tint }}
        >
          <Icon size={22} strokeWidth={1.8} className="text-white" />
        </span>
        <span className="text-2xs text-ink/80 text-center leading-tight line-clamp-2 pointer-events-none px-0.5">
          {item.label}
        </span>
      </button>
    );
  }

  // sticky
  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
      title="Drag to canvas or click to add"
    >
      <span className="w-11 h-11 flex items-center justify-center rounded-sm bg-sticky-yellow text-ink/70 pointer-events-none">
        <StickyNote size={20} strokeWidth={1.7} />
      </span>
      <span className="text-2xs text-ink/80 text-center leading-tight pointer-events-none">
        Sticky Note
      </span>
    </button>
  );
}
