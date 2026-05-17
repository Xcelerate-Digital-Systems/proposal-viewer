'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, ChevronLeft, Diamond, Clock, Flag, Phone, CalendarDays, Zap,
  MousePointerClick, FileText, PlayCircle, ChevronsDown, ShoppingBag, ShoppingCart,
  BellRing, Sparkles, MessageSquare, Mail, Bell, Sheet, StickyNote, PanelLeftOpen,
  Eye, Timer, LogOut, LogIn, Undo2, Download, Share2, Webhook,
  type LucideIcon,
} from 'lucide-react';
import type { FunnelStepType, FunnelShapeType } from '@/lib/supabase';
import {
  FUNNEL_STEP_DEFAULTS, FUNNEL_PALETTE,
  type PaletteItem, type PaletteGroup,
} from '@/lib/types/funnel';

interface Props {
  onPickStep: (stepType: FunnelStepType) => void;
  onPickShape: (shapeType: FunnelShapeType) => void;
  onPickSticky: () => void;
}

const SHAPE_ICONS: Record<string, LucideIcon> = {
  diamond: Diamond,
  clock: Clock,
  flag: Flag,
  phone: Phone,
  'calendar-days': CalendarDays,
  zap: Zap,
  'mouse-pointer-click': MousePointerClick,
  'file-text': FileText,
  'play-circle': PlayCircle,
  'chevrons-down': ChevronsDown,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'bell-ring': BellRing,
  sparkles: Sparkles,
  'message-square': MessageSquare,
  mail: Mail,
  bell: Bell,
  sheet: Sheet,
  eye: Eye,
  timer: Timer,
  'log-out': LogOut,
  'log-in': LogIn,
  'undo-2': Undo2,
  download: Download,
  'share-2': Share2,
  webhook: Webhook,
};

export default function NodePalette({ onPickStep, onPickShape, onPickSticky }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    pages: true, traffic: true, offers: true,
    logic: true, events: false, notifications: false, other: false,
  });

  const handlePick = (item: PaletteItem) => {
    if (item.kind === 'step') onPickStep(item.stepType);
    else if (item.kind === 'shape') onPickShape(item.shapeType as FunnelShapeType);
    else onPickSticky();
  };

  if (collapsed) {
    return (
      <aside className="w-9 shrink-0 border-r border-edge bg-white flex flex-col items-center pt-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface transition-colors"
          title="Open palette"
        >
          <PanelLeftOpen size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[240px] shrink-0 border-r border-edge bg-white overflow-y-auto">
      <div className="px-4 py-3 border-b border-edge sticky top-0 bg-white z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink">Add to canvas</h3>
          <p className="text-[11px] text-muted mt-0.5">Click any tile to drop it</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-ink/60 hover:text-ink hover:bg-surface transition-colors shrink-0"
          title="Collapse palette"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {FUNNEL_PALETTE.map((group) => (
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
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-muted hover:text-ink transition-colors mb-1.5"
      >
        <span>{group.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1.5">
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

  if (item.kind === 'step') {
    const def = FUNNEL_STEP_DEFAULTS[item.stepType];
    const isPage = item.stepType.startsWith('page_');
    return (
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={onClick}
        className="group flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
        title={`Drag to canvas or click to add: ${def.label}`}
      >
        {isPage ? (
          <span className="w-9 h-11 rounded-sm bg-white border border-edge shrink-0 overflow-hidden flex flex-col pointer-events-none">
            <span className="h-1.5 bg-surface border-b border-edge/60" />
            <span className="flex-1 flex flex-col items-center justify-center gap-[2px] px-1" style={{ backgroundColor: `${def.tint}10` }}>
              <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: def.tint }} />
              <span className="h-0.5 w-4 rounded-full bg-ink/20" />
              <span className="h-1 w-5 rounded-sm mt-0.5" style={{ backgroundColor: def.tint }} />
            </span>
          </span>
        ) : (
          <span className="w-7 h-7 rounded-full shrink-0 pointer-events-none" style={{ backgroundColor: def.tint }} />
        )}
        <span className="text-[10px] text-ink/80 text-center leading-tight line-clamp-2 pointer-events-none">
          {def.label}
        </span>
      </button>
    );
  }

  if (item.kind === 'shape') {
    const Icon = SHAPE_ICONS[item.iconName] || Diamond;
    return (
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={onClick}
        className="group flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
        title={`Drag to canvas or click to add: ${item.label}`}
      >
        <span className="w-9 h-9 flex items-center justify-center text-ink/70 bg-surface rounded-md pointer-events-none">
          <Icon size={18} strokeWidth={1.7} />
        </span>
        <span className="text-[10px] text-ink/80 text-center leading-tight line-clamp-2 pointer-events-none">
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
      className="group flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
      title="Drag to canvas or click to add"
    >
      <span className="w-9 h-9 flex items-center justify-center rounded-sm bg-sticky-yellow text-ink/70 pointer-events-none">
        <StickyNote size={16} strokeWidth={1.7} />
      </span>
      <span className="text-[10px] text-ink/80 text-center leading-tight pointer-events-none">
        Sticky Note
      </span>
    </button>
  );
}
