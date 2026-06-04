'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, ChevronLeft,
  Diamond,
  StickyNote, PanelLeftOpen,
  MousePointer2, Square, Circle, MoveRight, Minus, Type,
  Workflow, Pencil, Layers, Plus, CheckCircle2, X,
  Globe, Mail, Smartphone, Image as ImageIcon, Video, Megaphone, FileText, Eye, ClipboardList, Search, RectangleHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { BoardTool } from './BoardTopToolbar';
import type { FeedbackShapeType, FeedbackItemType } from '@/lib/types/feedback';
import {
  BOARD_ACTION_GROUPS, BOARD_ACTION_ICONS, BOARD_ACTION_TINTS,
} from '@/lib/types/board-actions';
import { useFeedbackBoardContext } from './FeedbackBoardContext';
import { getFeedbackStatusDef } from '@/lib/feedback/status';

interface Props {
  /** Currently active drawing tool — drives which Drawing-tab tile is highlighted. */
  activeTool: BoardTool;
  /** Click an Actions tile → spawn the matching shape at viewport centre. */
  onPickShape: (shapeType: FeedbackShapeType) => void;
  /** Click a Drawing tile → switch the active drawing/selection tool. */
  onPickTool: (tool: BoardTool) => void;
  /** Sticky note: click adds at default position. */
  onPickSticky: () => void;
  /** Returns the current viewport centre in flow coordinates. Used to place
   *  feedback items at the visible area instead of the flow origin. */
  getViewportCentre?: () => { x: number; y: number };
}

type PaletteTabId = 'items' | 'actions' | 'drawing';

const ITEM_TYPE_ICONS: Record<FeedbackItemType, LucideIcon> = {
  webpage: Globe,
  email: Mail,
  sms: Smartphone,
  image: ImageIcon,
  video: Video,
  ad: Megaphone,
  google_search_ad: Search,
  google_banner_ad: RectangleHorizontal,
  pdf: FileText,
  meta_lead_form: ClipboardList,
};

const ITEM_TYPE_LABELS: Record<FeedbackItemType, string> = {
  webpage: 'Web Page',
  email: 'Email',
  sms: 'SMS',
  image: 'Image',
  video: 'Video',
  ad: 'Meta Ad',
  google_search_ad: 'Google Search Ad',
  google_banner_ad: 'Google Banner Ad',
  pdf: 'PDF',
  meta_lead_form: 'Lead Form',
};

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

// "Items" tab is rendered out of the generic group/section pattern (it pulls
// live unplaced/placed items from board context) so it doesn't appear in the
// shared TABS list — instead it's special-cased in the renderer below.
const ITEMS_TAB: { id: PaletteTabId; label: string; icon: LucideIcon } = {
  id: 'items',
  label: 'Items',
  icon: Layers,
};

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

const SHAPE_SHORTCUTS: Partial<Record<FeedbackShapeType, string>> = {
  decision: 'D', wait: 'W', goal: 'G',
  call: 'C', meeting: 'M', automation: 'Z',
};

const DEFAULT_OPEN: Record<string, boolean> = {
  conversion: true, engagement: false, integration: false,
  gohighlevel: false, custom_actions: false,
  tools: true, notes: true,
};

/** Mime-type used to ferry a palette item from a tile drag to the canvas
 *  drop handler. JSON payload — see PaletteDragPayload below. */
export const FEEDBACK_PALETTE_DRAG_MIME = 'application/feedback-palette-item';

export type PaletteDragPayload =
  | { kind: 'shape'; shapeType: FeedbackShapeType }
  | { kind: 'sticky' };

export default function FeedbackPalette({ activeTool, onPickShape, onPickTool, onPickSticky, getViewportCentre }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<PaletteTabId>('items');
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const [actionSearch, setActionSearch] = useState('');

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

  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const handlePick = (item: PaletteItem) => {
    if (item.kind === 'shape') onPickShape(item.shapeType);
    else if (item.kind === 'tool') onPickTool(item.tool);
    else onPickSticky();
  };

  const needle = actionSearch.toLowerCase().trim();

  const filteredGroups = useMemo(() => {
    if (!needle || activeTab !== 'actions') return active.groups;
    return active.groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          const label = 'label' in item ? item.label : '';
          const shortcut = item.kind === 'shape' ? (SHAPE_SHORTCUTS[item.shapeType] ?? '') : '';
          return label.toLowerCase().includes(needle) || shortcut.toLowerCase() === needle;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [needle, activeTab, active.groups]);

  return (
    <aside className="w-[300px] shrink-0 border-r border-edge bg-white flex flex-col" role="complementary" aria-label="Canvas palette">
      <div className="px-4 py-3 border-b border-edge flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Add to canvas</h3>
          <p className="text-detail text-muted mt-0.5">Click or drag any tile to the canvas</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-ink/60 hover:text-ink hover:bg-surface transition-colors shrink-0"
          title="Collapse palette"
          aria-label="Collapse palette"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="flex border-b border-edge shrink-0" role="tablist">
        {[ITEMS_TAB, ...TABS].map((t) => {
          const Icon = t.icon;
          const isActive = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { setActiveTab(t.id); setActionSearch(''); }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-2xs font-medium transition-colors border-b-2 ${
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

      {activeTab === 'items' ? (
        <ItemsTabContent getViewportCentre={getViewportCentre} />
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col" role="tabpanel">
          {activeTab === 'actions' && (
            <div className="px-3 pt-3 pb-1 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
                <input
                  type="text"
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  placeholder="Filter actions…"
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-edge text-caption text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 bg-white placeholder:text-faint"
                  aria-label="Filter actions"
                />
                {actionSearch && (
                  <button
                    type="button"
                    onClick={() => setActionSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredGroups.length === 0 && needle ? (
              <p className="text-xs text-faint px-1 py-4 text-center">No matching actions</p>
            ) : (
              filteredGroups.map((group) => (
                <PaletteSection
                  key={group.key}
                  group={group}
                  open={!!needle || !!open[group.key]}
                  onToggle={() => setOpen((p) => ({ ...p, [group.key]: !p[group.key] }))}
                  activeTool={activeTool}
                  onPick={handlePick}
                />
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

/* ─── Items tab ─────────────────────────────────────────────
   Pulls unplaced + placed feedback items from board context and lets the
   user place them with a single click (mirrors the original
   FeedbackItemsSidebarNav UX that lived in the admin sidebar before this
   page switched to `collapseSidebar`). */

function ItemsTabContent({ getViewportCentre }: { getViewportCentre?: () => { x: number; y: number } }) {
  const ctx = useFeedbackBoardContext();
  const [showPlaced, setShowPlaced] = useState(true);

  if (!ctx) {
    return <p className="px-3 py-4 text-xs text-muted">Loading…</p>;
  }

  const { unplacedItems, placedItems, placeItem, removeItemFromBoard, openAddItem, loading } = ctx;

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <button
        type="button"
        onClick={openAddItem}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-caption font-semibold text-white bg-teal hover:bg-teal-hover transition-colors shadow-sm"
      >
        <Plus size={14} />
        New asset
      </button>

      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-2xs uppercase tracking-wider font-semibold text-muted">
            Add to board
          </span>
          <span className="text-2xs text-faint">{unplacedItems.length}</span>
        </div>

        {loading ? (
          <p className="text-xs text-faint px-1 py-2">Loading…</p>
        ) : unplacedItems.length === 0 ? (
          placedItems.length > 0 ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted bg-surface/60 rounded-lg">
              <CheckCircle2 size={14} className="text-emerald-500" />
              All items on the board
            </div>
          ) : (
            <p className="text-xs text-faint px-1 py-2">
              No assets yet. Use the “New asset” button to add one.
            </p>
          )
        ) : (
          <div className="space-y-0.5">
            {unplacedItems.map((item) => {
              const statusDef = getFeedbackStatusDef(item.status);
              const Icon = ITEM_TYPE_ICONS[item.type] ?? Eye;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const pos = getViewportCentre?.();
                    placeItem(item.id, pos ? { x: pos.x - 120, y: pos.y - 120 } : undefined);
                  }}
                  className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-ink/80 hover:text-ink hover:bg-surface transition-colors"
                >
                  <span className="w-5 flex justify-center text-muted group-hover:text-teal">
                    <Icon size={13} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-caption truncate leading-tight">{item.title}</span>
                    <span className="block text-2xs text-faint leading-tight">
                      {ITEM_TYPE_LABELS[item.type]}
                    </span>
                  </span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDef.dot}`} />
                  <Plus size={13} className="text-faint group-hover:text-teal transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {placedItems.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPlaced((v) => !v)}
            className="w-full flex items-center justify-between px-1 py-1.5 rounded text-muted hover:text-ink transition-colors"
          >
            <span className="text-2xs uppercase tracking-wider font-semibold">
              On board ({placedItems.length})
            </span>
            {showPlaced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {showPlaced && (
            <div className="space-y-0.5 mt-1">
              {placedItems.map((item) => {
                const statusDef = getFeedbackStatusDef(item.status);
                return (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDef.dot}`} />
                    <span className="flex-1 text-xs text-ink/70 truncate">{item.title}</span>
                    <button
                      type="button"
                      onClick={() => removeItemFromBoard(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted hover:text-red-500 transition-all"
                      title="Remove from board"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
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
        className="w-full flex items-center justify-between text-2xs uppercase tracking-wider font-semibold text-muted hover:text-ink transition-colors mb-1.5"
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
    const shortcut = SHAPE_SHORTCUTS[item.shapeType];
    return (
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={onClick}
        className="group relative flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-teal/30"
        title={shortcut ? `${item.label} (${shortcut})` : `Drag to canvas or click to add: ${item.label}`}
        aria-label={shortcut ? `Add ${item.label} (shortcut: ${shortcut})` : `Add ${item.label}`}
      >
        {shortcut && (
          <span className="absolute top-1 right-1 text-2xs text-faint/60 font-mono pointer-events-none">{shortcut}</span>
        )}
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

  if (item.kind === 'tool') {
    const Icon = item.icon;
    const active = activeTool === item.tool;
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-teal/30 ${
          active
            ? 'border-teal bg-teal/10 text-teal shadow-sm'
            : 'border-edge bg-white text-ink hover:border-teal/50 hover:shadow-sm'
        }`}
        title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
        aria-label={item.shortcut ? `${item.label} tool (shortcut: ${item.shortcut})` : `${item.label} tool`}
        aria-pressed={active}
      >
        <span
          className={`w-11 h-11 flex items-center justify-center rounded-full pointer-events-none ${
            active ? 'bg-teal text-white' : 'bg-surface text-ink/80'
          }`}
        >
          <Icon size={22} strokeWidth={1.8} />
        </span>
        <span className="text-2xs text-center leading-tight line-clamp-2 pointer-events-none px-0.5">
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
      className="group flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border border-edge bg-white hover:border-teal/50 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-teal/30"
      title="Drag to canvas or click to add"
      aria-label="Add sticky note"
    >
      <span className="w-11 h-11 flex items-center justify-center rounded-sm bg-sticky-yellow text-ink/70 pointer-events-none">
        <StickyNote size={20} strokeWidth={1.7} />
      </span>
      <span className="text-2xs text-ink/80 text-center leading-tight pointer-events-none">
        {item.label}
      </span>
    </button>
  );
}
