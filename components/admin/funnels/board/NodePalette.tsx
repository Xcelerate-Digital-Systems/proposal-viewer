'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Diamond, Clock, Flag, Phone, CalendarDays, Zap,
  MousePointerClick, FileText, PlayCircle, ChevronsDown, ShoppingBag, ShoppingCart,
  BellRing, Sparkles, MessageSquare, Mail, Bell, Sheet, StickyNote,
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
};

export default function NodePalette({ onPickStep, onPickShape, onPickSticky }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    pages: true, traffic: true, offers: true,
    logic: true, events: false, notifications: false, other: false,
  });

  const handlePick = (item: PaletteItem) => {
    if (item.kind === 'step') onPickStep(item.stepType);
    else if (item.kind === 'shape') onPickShape(item.shapeType as FunnelShapeType);
    else onPickSticky();
  };

  return (
    <aside className="w-[240px] shrink-0 border-r border-edge bg-white overflow-y-auto">
      <div className="px-4 py-3 border-b border-edge sticky top-0 bg-white z-10">
        <h3 className="text-[13px] font-semibold text-ink">Add to canvas</h3>
        <p className="text-[11px] text-muted mt-0.5">Click any tile to drop it</p>
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

function PaletteTile({ item, onClick }: { item: PaletteItem; onClick: () => void }) {
  if (item.kind === 'step') {
    const def = FUNNEL_STEP_DEFAULTS[item.stepType];
    const isPage = item.stepType.startsWith('page_');
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all"
        title={`Add ${def.label}`}
      >
        {isPage ? (
          <span className="w-9 h-11 rounded-sm bg-white border border-edge shrink-0 overflow-hidden flex flex-col">
            <span className="h-1.5 bg-surface border-b border-edge/60" />
            <span className="flex-1 flex flex-col items-center justify-center gap-[2px] px-1" style={{ backgroundColor: `${def.tint}10` }}>
              <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: def.tint }} />
              <span className="h-0.5 w-4 rounded-full bg-ink/20" />
              <span className="h-1 w-5 rounded-sm mt-0.5" style={{ backgroundColor: def.tint }} />
            </span>
          </span>
        ) : (
          <span className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: def.tint }} />
        )}
        <span className="text-[10px] text-ink/80 text-center leading-tight line-clamp-2">
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
        onClick={onClick}
        className="group flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all"
        title={`Add ${item.label}`}
      >
        <span className="w-9 h-9 flex items-center justify-center text-ink/70 bg-surface rounded-md">
          <Icon size={18} strokeWidth={1.7} />
        </span>
        <span className="text-[10px] text-ink/80 text-center leading-tight line-clamp-2">
          {item.label}
        </span>
      </button>
    );
  }

  // sticky
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all"
      title="Add sticky note"
    >
      <span className="w-9 h-9 flex items-center justify-center rounded-sm bg-sticky-yellow text-ink/70">
        <StickyNote size={16} strokeWidth={1.7} />
      </span>
      <span className="text-[10px] text-ink/80 text-center leading-tight">
        Sticky Note
      </span>
    </button>
  );
}
