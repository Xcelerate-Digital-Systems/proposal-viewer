'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, ChevronLeft,
  Diamond,
  StickyNote, PanelLeftOpen,
  MousePointer2, Square, Circle, MoveRight, Minus, Type,
  Workflow, Pencil,
  type LucideIcon,
} from 'lucide-react';
import type { BoardTool } from './BoardTopToolbar';
import type { FeedbackShapeType } from '@/lib/types/feedback';
import {
  BOARD_ACTION_GROUPS, BOARD_ACTION_ICONS, BOARD_ACTION_TINTS,
} from '@/lib/types/board-actions';

interface Props {
  /** Currently active drawing tool — drives which Drawing-tab tile is highlighted. */
  activeTool: BoardTool;
  /** Click an Actions tile → spawn the matching shape at viewport centre. */
  onPickShape: (shapeType: FeedbackShapeType) => void;
  /** Click a Drawing tile → switch the active drawing/selection tool. */
  onPickTool: (tool: BoardTool) => void;
  /** Sticky note: click adds at default position. */
  onPickSticky: () => void;
}

type PaletteTabId = 'actions' | 'drawing';

interface ShapeItem {
  kind: 'shape';
  shapeType: FeedbackShapeType;
  label: string;
  icon: LucideIcon;
}

interface ToolItem {
  kind: 'tool';
  tool: BoardTool;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

interface StickyItem {
  kind: 'sticky';
  label: string;
}

type PaletteItem = ShapeItem | ToolItem | StickyItem;

interface PaletteGroup {
  key: string;
  label: string;
  items: PaletteItem[];
}

interface PaletteTab {
  id: PaletteTabId;
  label: string;
  icon: LucideIcon;
  groups: PaletteGroup[];
}

const TABS: PaletteTab[] = [
  {
    id: 'actions',
    label: 'Actions',
    icon: Workflow,
    // Actions tiles come from the shared BOARD_ACTION_GROUPS registry so a
    // new action added for one board (feedback/funnel) appears in the other.
    groups: BOARD_ACTION_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      items: g.items.map<PaletteItem>((i) => ({
        kind: 'shape',
        shapeType: i.shapeType as FeedbackShapeType,
        label: i.label,
        icon: BOARD_ACTION_ICONS[i.iconName] ?? Diamond,
      })),
    })),
  },
  {
    id: 'drawing',
    label: 'Drawing',
    icon: Pencil,
    groups: [
      {
        key: 'tools',
        label: 'Tools',
        items: [
          { kind: 'tool', tool: 'select',    label: 'Select',    icon: MousePointer2, shortcut: 'V' },
          { kind: 'tool', tool: 'rectangle', label: 'Rectangle', icon: Square,        shortcut: 'R' },
          { kind: 'tool', tool: 'ellipse',   label: 'Ellipse',   icon: Circle,        shortcut: 'O' },
          { kind: 'tool', tool: 'arrow',     label: 'Arrow',     icon: MoveRight,     shortcut: 'A' },
          { kind: 'tool', tool: 'line',      label: 'Line',      icon: Minus,         shortcut: 'L' },
          { kind: 'tool', tool: 'text',      label: 'Text',      icon: Type,          shortcut: 'T' },
        ],
      },
      {
        key: 'notes',
        label: 'Notes',
        items: [{ kind: 'sticky', label: 'Sticky Note' }],
      },
    ],
  },
];

const DEFAULT_OPEN: Record<string, boolean> = {
  conversion: true, engagement: true, integration: false,
  gohighlevel: true, custom_actions: false,
  tools: true, notes: true,
};

/** Mime-type used to ferry a palette item from a tile drag to the canvas
 *  drop handler. JSON payload — see PaletteDragPayload below. */
export const FEEDBACK_PALETTE_DRAG_MIME = 'application/feedback-palette-item';

export type PaletteDragPayload =
  | { kind: 'shape'; shapeType: FeedbackShapeType }
  | { kind: 'sticky' };

export default function FeedbackPalette({ activeTool, onPickShape, onPickTool, onPickSticky }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<PaletteTabId>('actions');
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);

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

  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const handlePick = (item: PaletteItem) => {
    if (item.kind === 'shape') onPickShape(item.shapeType);
    else if (item.kind === 'tool') onPickTool(item.tool);
    else onPickSticky();
  };

  return (
    <aside className="w-[300px] shrink-0 border-r border-edge bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-edge flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-ink">Add to canvas</h3>
          <p className="text-[11px] text-muted mt-0.5">Click or drag any tile to the canvas</p>
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

      <div className="flex border-b border-edge shrink-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium transition-colors border-b-2 ${
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
            activeTool={activeTool}
            onPick={handlePick}
          />
        ))}
      </div>
    </aside>
  );
}

function PaletteSection({
  group, open, onToggle, activeTool, onPick,
}: {
  group: PaletteGroup;
  open: boolean;
  onToggle: () => void;
  activeTool: BoardTool;
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
        <div className="grid grid-cols-3 gap-2">
          {group.items.map((item, i) => (
            <PaletteTile key={i} item={item} activeTool={activeTool} onClick={() => onPick(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PaletteTile({ item, activeTool, onClick }: {
  item: PaletteItem;
  activeTool: BoardTool;
  onClick: () => void;
}) {
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    if (item.kind === 'shape') {
      e.dataTransfer.setData(FEEDBACK_PALETTE_DRAG_MIME, JSON.stringify({ kind: 'shape', shapeType: item.shapeType }));
      e.dataTransfer.effectAllowed = 'copy';
    } else if (item.kind === 'sticky') {
      e.dataTransfer.setData(FEEDBACK_PALETTE_DRAG_MIME, JSON.stringify({ kind: 'sticky' }));
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  if (item.kind === 'shape') {
    const Icon = item.icon;
    const tint = BOARD_ACTION_TINTS[item.shapeType as keyof typeof BOARD_ACTION_TINTS] || '#64748B';
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
        <span className="text-[10px] text-ink/80 text-center leading-tight line-clamp-2 pointer-events-none px-0.5">
          {item.label}
        </span>
      </button>
    );
  }

  if (item.kind === 'tool') {
    const Icon = item.icon;
    const active = activeTool === item.tool;
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border transition-all ${
          active
            ? 'border-teal bg-teal/10 text-teal shadow-sm'
            : 'border-edge bg-white text-ink hover:border-teal/50 hover:shadow-sm'
        }`}
        title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
      >
        <span
          className={`w-11 h-11 flex items-center justify-center rounded-full pointer-events-none ${
            active ? 'bg-teal text-white' : 'bg-surface text-ink/80'
          }`}
        >
          <Icon size={22} strokeWidth={1.8} />
        </span>
        <span className="text-[10px] text-center leading-tight line-clamp-2 pointer-events-none px-0.5">
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
      <span className="text-[10px] text-ink/80 text-center leading-tight pointer-events-none">
        {item.label}
      </span>
    </button>
  );
}
