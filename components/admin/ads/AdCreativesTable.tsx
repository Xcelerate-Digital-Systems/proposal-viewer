// components/admin/ads/AdCreativesTable.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronUp, ChevronDown, Megaphone, MoreHorizontal,
  Pencil, Trash2, ExternalLink,
} from 'lucide-react';
import type { AdCreativeWithVariants, AdAccountStandards, TrackerStandards } from '@/lib/supabase';
import { type SelectOption } from './CustomSelect';
import {
  AD_CREATIVE_STATUSES,
  AD_WINNER_STATUSES,
  AWARENESS_LEVELS,
  MARKET_SOPHISTICATION_LEVELS,
  AD_MEDIA_TYPES,
  AD_ITERATION_TYPES,
  AD_SIGNALS,
  AD_ANGLE_FAMILIES,
  AD_CREATIVE_STYLES,
  AD_CREATIVE_FORMATS,
} from '@/lib/ad-tracker/constants';

type Props = {
  creatives: AdCreativeWithVariants[];
  loading: boolean;
  sortBy: string;
  sortDir: string;
  companyId: string;
  onSort: (column: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<{ error?: string }>;
  accountStandards?: AdAccountStandards | null;
  trackerStandards?: TrackerStandards;
};

// ─── Column config ──────────────────────────────────────────────────────────

type CellType = 'text' | 'select' | 'badge' | 'number' | 'date' | 'link' | 'readonly' | 'thumbnail';

type ColumnDef = {
  key: string;
  label: string;
  sortable?: boolean;
  cellType: CellType;
  options?: SelectOption[];
  badgeColors?: Record<string, string>;
  suffix?: string;
  prefix?: string;
  maxWidth?: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  briefed: 'bg-blue-50 text-blue-600',
  in_production: 'bg-purple-50 text-purple-600',
  ready: 'bg-teal-50 text-teal-600',
  live: 'bg-green-50 text-green-700',
  paused: 'bg-amber-50 text-amber-600',
  killed: 'bg-red-50 text-red-600',
};

const WINNER_COLORS: Record<string, string> = {
  yes: 'bg-green-50 text-green-700',
  scaled: 'bg-green-50 text-green-700',
  no: 'bg-gray-100 text-gray-500',
  didnt_win: 'bg-red-50 text-red-600',
  stopped: 'bg-red-50 text-red-600',
  fatigued: 'bg-amber-50 text-amber-600',
};

const toOpts = (arr: { value: string; label: string; description?: string }[]): SelectOption[] =>
  arr.map((a) => ({ value: a.value, label: a.label, description: 'description' in a ? (a as { description?: string }).description : undefined }));

const COLUMNS: ColumnDef[] = [
  { key: '_thumb', label: '', cellType: 'thumbnail' },
  { key: 'ad_name', label: 'Ad Name', sortable: true, cellType: 'text', maxWidth: '220px' },
  { key: 'status', label: 'Status', sortable: true, cellType: 'badge', options: toOpts(AD_CREATIVE_STATUSES), badgeColors: STATUS_COLORS },
  { key: 'iteration_type', label: 'Type', cellType: 'select', options: toOpts(AD_ITERATION_TYPES) },
  { key: 'media_type', label: 'Media', cellType: 'select', options: toOpts(AD_MEDIA_TYPES) },
  { key: 'signal', label: 'Signal', cellType: 'select', options: toOpts(AD_SIGNALS) },
  { key: 'angle_family', label: 'Angle Family', cellType: 'select', options: toOpts(AD_ANGLE_FAMILIES) },
  { key: 'angle_idea', label: 'Angle Idea', cellType: 'text', maxWidth: '150px' },
  { key: 'creative_style', label: 'Style', cellType: 'select', options: toOpts(AD_CREATIVE_STYLES) },
  { key: 'creative_format', label: 'Format', cellType: 'select', options: toOpts(AD_CREATIVE_FORMATS) },
  { key: 'target_market', label: 'Target Market', cellType: 'text', maxWidth: '150px' },
  { key: 'awareness_level', label: 'Awareness', cellType: 'select', options: toOpts(AWARENESS_LEVELS) },
  { key: 'market_sophistication', label: 'Sophistication', cellType: 'select', options: toOpts(MARKET_SOPHISTICATION_LEVELS) },
  { key: 'offer_variant', label: 'Offer', cellType: 'text', maxWidth: '150px' },
  { key: 'lander_variant', label: 'Lander', cellType: 'text', maxWidth: '150px' },
  { key: 'winner', label: 'Winner', sortable: true, cellType: 'badge', options: toOpts(AD_WINNER_STATUSES), badgeColors: WINNER_COLORS },
  { key: 'launch_date', label: 'Launch', sortable: true, cellType: 'date' },
  { key: 'creative_lifespan_days', label: 'Lifespan', cellType: 'number', suffix: 'd' },
  { key: 'hook_rate', label: 'Hook %', sortable: true, cellType: 'number', suffix: '%' },
  { key: 'hold_rate', label: 'Hold %', sortable: true, cellType: 'number', suffix: '%' },
  { key: 'uctr', label: 'UCTR', sortable: true, cellType: 'number' },
  { key: 'cvr', label: 'CVR', sortable: true, cellType: 'number' },
  { key: 'cpl', label: 'CPL', sortable: true, cellType: 'number', prefix: '$' },
  { key: '_links', label: 'Links', cellType: 'readonly' },
  { key: '_copy', label: 'Copy', cellType: 'readonly' },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function SortHeader({ label, column, sortBy, sortDir, onSort }: {
  label: string; column: string; sortBy: string; sortDir: string; onSort: (c: string) => void;
}) {
  const active = sortBy === column;
  return (
    <th
      className="px-3 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wider cursor-pointer hover:text-ink select-none whitespace-nowrap"
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );
}

function ColHeader({ col, sortBy, sortDir, onSort }: { col: ColumnDef; sortBy: string; sortDir: string; onSort: (c: string) => void }) {
  if (col.cellType === 'thumbnail') {
    return <th className="px-2 py-3 w-[68px]" />;
  }
  if (col.sortable) {
    return <SortHeader label={col.label} column={col.key} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />;
  }
  return (
    <th className="px-3 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
      {col.label}
    </th>
  );
}

// ─── Display cells ──────────────────────────────────────────────────────────

function BadgeDisplay({ value, map, colors }: { value: string | null; map: SelectOption[]; colors: Record<string, string> }) {
  if (!value) return <span className="text-faint">—</span>;
  const item = map.find((s) => s.value === value);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
      {item?.label || value}
    </span>
  );
}

function TextDisplay({ value, maxWidth }: { value: string | null; maxWidth?: string }) {
  if (!value) return <span className="text-faint">—</span>;
  return (
    <span className={`text-[13px] text-muted truncate block ${maxWidth ? `max-w-[${maxWidth}]` : ''}`}>
      {value}
    </span>
  );
}

function NumberDisplay({ value, prefix, suffix, meetsStandard }: { value: number | null; prefix?: string; suffix?: string; meetsStandard?: boolean | null }) {
  if (value === null || value === undefined) return <span className="text-faint">—</span>;
  let colorClass = 'text-ink';
  if (meetsStandard === true) colorClass = 'text-green-600';
  if (meetsStandard === false) colorClass = 'text-red-500';
  return <span className={`text-[13px] ${colorClass} tabular-nums`}>{prefix}{value}{suffix}</span>;
}

function SelectDisplay({ value, options }: { value: string | null; options: SelectOption[] }) {
  if (!value) return <span className="text-faint">—</span>;
  const item = options.find((o) => o.value === value);
  return <span className="text-[13px] text-muted truncate block">{item?.label || value}</span>;
}

// Check if a metric value meets a target (higher is better for rates, lower is better for cost)
function checkStandard(value: number | null, target: number | null | undefined, lowerIsBetter = false): boolean | null {
  if (value === null || value === undefined || !target) return null;
  return lowerIsBetter ? value <= target : value >= target;
}

// ─── Main table ─────────────────────────────────────────────────────────────

export default function AdCreativesTable({
  creatives, loading, sortBy, sortDir, companyId, onSort, onEdit, onDelete,
  accountStandards, trackerStandards,
}: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (creatives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center">
          <Megaphone size={24} className="text-faint" />
        </div>
        <p className="text-sm text-muted">No creatives yet</p>
        <p className="text-xs text-faint">Click &ldquo;New Creative&rdquo; to add your first ad</p>
      </div>
    );
  }

  // Use custom metric label for CPL column if set
  const columns = COLUMNS.map((col) => {
    if (col.key === 'cpl' && trackerStandards?.metric_label) {
      return { ...col, label: trackerStandards.metric_label };
    }
    return col;
  });

  const getValue = (c: AdCreativeWithVariants, key: string): unknown => {
    return (c as Record<string, unknown>)[key] ?? null;
  };

  const renderCell = (c: AdCreativeWithVariants, col: ColumnDef) => {
    const raw = getValue(c, col.key);

    // Thumbnail column
    if (col.cellType === 'thumbnail') {
      const isVideo = c.image_url && /\.(mp4|mov|webm)$/i.test(c.image_url);
      return (
        <td key={col.key} className="px-2 py-1.5 w-[68px]">
          {c.image_url ? (
            <div className="w-[52px] h-[52px] rounded-lg overflow-hidden bg-surface">
              {isVideo ? (
                <video src={c.image_url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={c.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ) : (
            <div className="w-[52px] h-[52px] rounded-lg bg-surface border border-dashed border-edge flex items-center justify-center">
              <Megaphone size={16} className="text-faint" />
            </div>
          )}
        </td>
      );
    }

    // Special readonly columns
    if (col.key === '_links') {
      return (
        <td key={col.key} className="px-3 py-2.5">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {c.brief_link ? (
              <a href={c.brief_link} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                <ExternalLink size={12} />
              </a>
            ) : <span className="text-faint">—</span>}
            {c.creative_link ? (
              <a href={c.creative_link} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                <ExternalLink size={12} />
              </a>
            ) : null}
          </div>
        </td>
      );
    }

    if (col.key === '_copy') {
      return (
        <td key={col.key} className="px-3 py-2.5 text-[13px] text-muted">
          {c.ad_copy_variants?.length || 0}
        </td>
      );
    }

    // Badge cells
    if (col.cellType === 'badge') {
      return (
        <td key={col.key} className="px-3 py-2.5">
          <BadgeDisplay value={raw as string | null} map={col.options!} colors={col.badgeColors!} />
        </td>
      );
    }

    // Select cells
    if (col.cellType === 'select') {
      return (
        <td key={col.key} className="px-3 py-2.5">
          <SelectDisplay value={raw as string | null} options={col.options!} />
        </td>
      );
    }

    // Text cells
    if (col.cellType === 'text') {
      const strVal = (raw as string) || '';
      return (
        <td key={col.key} className={`px-3 py-2.5 ${col.maxWidth ? `max-w-[${col.maxWidth}]` : ''}`}>
          {col.key === 'ad_name' ? (
            <>
              <span className="text-[13px] font-medium text-ink truncate block">{strVal || '—'}</span>
              {c.ad_concept && <span className="text-[11px] text-faint truncate block mt-0.5">{c.ad_concept}</span>}
            </>
          ) : (
            <TextDisplay value={strVal || null} maxWidth={col.maxWidth} />
          )}
        </td>
      );
    }

    // Number cells
    if (col.cellType === 'number') {
      const numVal = raw as number | null;
      let meetsStandard: boolean | null = null;
      if (col.key === 'hook_rate') meetsStandard = checkStandard(numVal, accountStandards?.hook_rate_target);
      else if (col.key === 'hold_rate') meetsStandard = checkStandard(numVal, accountStandards?.hold_rate_target);
      else if (col.key === 'uctr') meetsStandard = checkStandard(numVal, accountStandards?.uctr_target);
      else if (col.key === 'cpl') meetsStandard = checkStandard(numVal, trackerStandards?.cpl_target, true);

      return (
        <td key={col.key} className="px-3 py-2.5 whitespace-nowrap">
          <NumberDisplay value={numVal} prefix={col.prefix} suffix={col.suffix} meetsStandard={meetsStandard} />
        </td>
      );
    }

    // Date cells
    if (col.cellType === 'date') {
      const dateVal = raw as string | null;
      return (
        <td key={col.key} className="px-3 py-2.5 text-[13px] text-muted whitespace-nowrap">
          {dateVal ? new Date(dateVal).toLocaleDateString() : <span className="text-faint">—</span>}
        </td>
      );
    }

    return <td key={col.key} className="px-3 py-2.5 text-[13px] text-muted">—</td>;
  };

  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[1600px]">
        <thead className="bg-ivory border-b border-edge sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <ColHeader key={col.key} col={col} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            ))}
            <th className="px-3 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {creatives.map((c) => (
            <tr
              key={c.id}
              onClick={() => onEdit(c.id)}
              className="hover:bg-surface/50 transition-colors group cursor-pointer"
            >
              {columns.map((col) => renderCell(c, col))}

              {/* Actions menu */}
              <td className="px-3 py-2.5 relative">
                <div className="relative" ref={menuOpenId === c.id ? menuRef : undefined}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === c.id ? null : c.id);
                    }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-faint hover:text-muted hover:bg-surface opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {menuOpenId === c.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-edge rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          onEdit(c.id);
                        }}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-ink hover:bg-surface flex items-center gap-2"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          onDelete(c.id);
                        }}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
