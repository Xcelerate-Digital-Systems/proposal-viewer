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
  hint?: string;
  sortable?: boolean;
  cellType: CellType;
  options?: SelectOption[];
  badgeColors?: Record<string, string>;
  suffix?: string;
  prefix?: string;
  maxWidth?: string;
  minWidth?: string;
  groupIdx?: number;
  firstInGroup?: boolean; // true on the first column of each group (for left border)
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

// Column groups for the grouped header row
const COLUMN_GROUPS: { label: string; colSpan: number }[] = [
  { label: 'Ad Details', colSpan: 2 },
  { label: 'Step 1: Ad Strategy', colSpan: 5 },
  { label: 'Step 2: Who is the audience', colSpan: 3 },
  { label: 'Step 3: Where is the ad going', colSpan: 2 },
  { label: 'Step 4: How will you execute the ad', colSpan: 8 },
  { label: 'Content', colSpan: 4 },
  { label: 'Step 5: Results & Learnings', colSpan: 11 },
];

const COLUMNS: ColumnDef[] = [
  // Group 0 — Ad Details
  { key: '_thumb', label: '', cellType: 'thumbnail', groupIdx: 0 },
  { key: 'ad_name', label: 'Ad Name', hint: 'Use the naming convention', sortable: true, cellType: 'text', maxWidth: '280px', minWidth: '180px', groupIdx: 0 },
  // Group 1 — Step 1: Ad Strategy
  { key: 'signal', label: 'Signal', hint: 'Where does the data come from?', cellType: 'select', options: toOpts(AD_SIGNALS), minWidth: '130px', groupIdx: 1, firstInGroup: true },
  { key: 'hypothesis', label: 'Hypothesis', hint: 'Links one data insight to one predicted ad outcome', cellType: 'text', maxWidth: '240px', minWidth: '160px', groupIdx: 1 },
  { key: 'ad_concept', label: 'Ad Concept', hint: 'Overall idea of the ad in 1-2 sentences', cellType: 'text', maxWidth: '240px', minWidth: '160px', groupIdx: 1 },
  { key: 'angle_family', label: 'Angle Family', hint: 'See the reference sheet if unsure', cellType: 'select', options: toOpts(AD_ANGLE_FAMILIES), minWidth: '140px', groupIdx: 1 },
  { key: 'angle_idea', label: 'Angle Idea', hint: 'Categorisation for data analysis & brainstorming', cellType: 'text', maxWidth: '200px', minWidth: '140px', groupIdx: 1 },
  // Group 2 — Step 2: Who is the audience
  { key: 'target_market', label: 'Target Market', hint: 'Choose or add to drop down', cellType: 'text', maxWidth: '200px', minWidth: '140px', groupIdx: 2, firstInGroup: true },
  { key: 'awareness_level', label: 'Awareness Level', hint: 'Choose which stage they are at', cellType: 'select', options: toOpts(AWARENESS_LEVELS), minWidth: '140px', groupIdx: 2 },
  { key: 'market_sophistication', label: 'Market Sophistication', hint: 'Choose which stage they are at', cellType: 'select', options: toOpts(MARKET_SOPHISTICATION_LEVELS), minWidth: '160px', groupIdx: 2 },
  // Group 3 — Step 3: Where is the ad going
  { key: 'offer_variant', label: 'Offer Variant', hint: 'Which offer will the ad go to?', cellType: 'text', maxWidth: '200px', minWidth: '140px', groupIdx: 3, firstInGroup: true },
  { key: 'lander_variant', label: 'Lander Variant', hint: 'Which landing page will the ad go to?', cellType: 'text', maxWidth: '200px', minWidth: '140px', groupIdx: 3 },
  // Group 4 — Step 4: How will you execute the ad
  { key: 'iteration_type', label: 'Type', hint: 'New ad or iteration on winning ad', cellType: 'select', options: toOpts(AD_ITERATION_TYPES), minWidth: '110px', groupIdx: 4, firstInGroup: true },
  { key: 'media_type', label: 'Media', hint: 'Still vs video', cellType: 'select', options: toOpts(AD_MEDIA_TYPES), minWidth: '110px', groupIdx: 4 },
  { key: 'creative_style', label: 'Creative Style', hint: 'How will the platform read the creative type', cellType: 'select', options: toOpts(AD_CREATIVE_STYLES), minWidth: '130px', groupIdx: 4 },
  { key: 'creative_format', label: 'Creative Format', hint: 'Helps with brainstorming & data analysis', cellType: 'select', options: toOpts(AD_CREATIVE_FORMATS), minWidth: '140px', groupIdx: 4 },
  { key: 'video_hooks', label: 'Video Hooks', hint: 'What is the hook of the video?', cellType: 'text', maxWidth: '200px', minWidth: '140px', groupIdx: 4 },
  { key: 'status', label: 'Status', hint: 'What is the status of the ad?', sortable: true, cellType: 'badge', options: toOpts(AD_CREATIVE_STATUSES), badgeColors: STATUS_COLORS, minWidth: '110px', groupIdx: 4 },
  { key: '_links', label: 'Links', hint: 'Brief & creative links', cellType: 'readonly', minWidth: '80px', groupIdx: 4 },
  { key: '_ad_copy_link', label: 'Ad Copy', hint: 'Google doc link', cellType: 'readonly', minWidth: '80px', groupIdx: 4 },
  // Group 5 — Content
  { key: '_headline', label: 'Headline', cellType: 'readonly', minWidth: '140px', maxWidth: '200px', groupIdx: 5, firstInGroup: true },
  { key: '_primary_text', label: 'Primary Text', cellType: 'readonly', minWidth: '160px', maxWidth: '240px', groupIdx: 5 },
  { key: '_description', label: 'Description', cellType: 'readonly', minWidth: '140px', maxWidth: '200px', groupIdx: 5 },
  { key: '_cta', label: 'CTA', cellType: 'readonly', minWidth: '100px', groupIdx: 5 },
  // Group 6 — Step 5: Results & Learnings
  { key: 'winner', label: 'Winner?', hint: 'After 7 days, what was the outcome?', sortable: true, cellType: 'badge', options: toOpts(AD_WINNER_STATUSES), badgeColors: WINNER_COLORS, minWidth: '110px', groupIdx: 6, firstInGroup: true },
  { key: 'launch_date', label: 'Launch Date', hint: 'When it went live', sortable: true, cellType: 'date', minWidth: '110px', groupIdx: 6 },
  { key: 'analysis_date', label: 'Analysis Date', cellType: 'date', minWidth: '110px', groupIdx: 6 },
  { key: 'kill_date', label: 'Kill Date', hint: 'When did we turn off the ad?', cellType: 'date', minWidth: '110px', groupIdx: 6 },
  { key: 'creative_lifespan_days', label: 'Creative Lifespan', hint: 'How long did the ad run for?', cellType: 'number', suffix: 'd', minWidth: '100px', groupIdx: 6 },
  { key: 'hook_rate', label: 'Hook Rate', hint: '30%+', sortable: true, cellType: 'number', suffix: '%', minWidth: '90px', groupIdx: 6 },
  { key: 'hold_rate', label: 'Hold Rate', hint: '10%+', sortable: true, cellType: 'number', suffix: '%', minWidth: '90px', groupIdx: 6 },
  { key: 'uctr', label: 'UCTR', hint: '1.25%+', sortable: true, cellType: 'number', minWidth: '80px', groupIdx: 6 },
  { key: 'cvr', label: 'CVR', hint: 'Conversions / clicks', sortable: true, cellType: 'number', minWidth: '80px', groupIdx: 6 },
  { key: 'cpl', label: 'CPL/Metric', sortable: true, cellType: 'number', prefix: '$', minWidth: '90px', groupIdx: 6 },
  { key: 'next_action', label: 'Next Action / Learning', cellType: 'text', maxWidth: '240px', minWidth: '160px', groupIdx: 6 },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

const GROUP_BORDER = 'border-l-2 border-l-edge-hover';

function SortHeader({ label, hint, column, sortBy, sortDir, onSort, firstInGroup, minWidth }: {
  label: string; hint?: string; column: string; sortBy: string; sortDir: string; onSort: (c: string) => void; firstInGroup?: boolean; minWidth?: string;
}) {
  const active = sortBy === column;
  return (
    <th
      className={`px-3 py-2 text-left cursor-pointer hover:text-ink select-none ${firstInGroup ? GROUP_BORDER : ''}`}
      style={minWidth ? { minWidth } : undefined}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
        {label}
        {active && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
      {hint && <span className="block text-[10px] text-faint font-normal normal-case tracking-normal mt-0.5 leading-tight">{hint}</span>}
    </th>
  );
}

function ColHeader({ col, sortBy, sortDir, onSort }: { col: ColumnDef; sortBy: string; sortDir: string; onSort: (c: string) => void }) {
  const border = col.firstInGroup ? GROUP_BORDER : '';
  if (col.cellType === 'thumbnail') {
    return <th className={`px-2 py-2 w-[68px] ${border}`} />;
  }
  if (col.sortable) {
    return <SortHeader label={col.label} hint={col.hint} column={col.key} sortBy={sortBy} sortDir={sortDir} onSort={onSort} firstInGroup={col.firstInGroup} minWidth={col.minWidth} />;
  }
  return (
    <th
      className={`px-3 py-2 text-left ${border}`}
      style={col.minWidth ? { minWidth: col.minWidth } : undefined}
    >
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">{col.label}</span>
      {col.hint && <span className="block text-[10px] text-faint font-normal normal-case tracking-normal mt-0.5 leading-tight">{col.hint}</span>}
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
  let bgClass = '';
  if (meetsStandard === true) { colorClass = 'text-green-700'; bgClass = 'bg-green-50 border border-green-100'; }
  if (meetsStandard === false) { colorClass = 'text-red-600'; bgClass = 'bg-red-50 border border-red-100'; }
  return (
    <span className={`text-[13px] ${colorClass} tabular-nums ${bgClass ? `inline-block px-2 py-0.5 rounded-md ${bgClass}` : ''}`}>
      {prefix}{value}{suffix}
    </span>
  );
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
    const gb = col.firstInGroup ? GROUP_BORDER : '';

    // Thumbnail column
    if (col.cellType === 'thumbnail') {
      const isVideo = c.image_url && /\.(mp4|mov|webm)$/i.test(c.image_url);
      return (
        <td key={col.key} className={`px-2 py-1.5 w-[166px] ${gb}`}>
          {c.image_url ? (
            <div className="w-[150px] h-[150px] rounded-lg overflow-hidden bg-surface">
              {isVideo ? (
                <video src={c.image_url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={c.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          ) : (
            <div className="w-[150px] h-[150px] rounded-lg bg-surface border border-dashed border-edge flex items-center justify-center">
              <Megaphone size={20} className="text-faint" />
            </div>
          )}
        </td>
      );
    }

    // Special readonly columns
    if (col.key === '_links') {
      return (
        <td key={col.key} className={`px-3 py-2.5 ${gb}`}>
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

    if (col.key === '_ad_copy_link') {
      return (
        <td key={col.key} className={`px-3 py-2.5 ${gb}`} onClick={(e) => e.stopPropagation()}>
          {c.ad_copy_link ? (
            <a href={c.ad_copy_link} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
              <ExternalLink size={12} />
            </a>
          ) : <span className="text-faint">—</span>}
        </td>
      );
    }

    // Copy variant columns — truncate to 2 lines max
    if (col.key === '_headline' || col.key === '_primary_text' || col.key === '_description' || col.key === '_cta') {
      const typeMap: Record<string, string> = { _headline: 'headline', _primary_text: 'primary_text', _description: 'description', _cta: 'cta' };
      const variant = c.ad_copy_variants?.find((v) => v.variant_type === typeMap[col.key]);
      return (
        <td key={col.key} className={`px-3 py-2.5 ${gb}`} style={col.maxWidth ? { maxWidth: col.maxWidth } : undefined}>
          {variant?.content ? (
            <span className="text-[13px] text-muted block overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={variant.content}>{variant.content}</span>
          ) : (
            <span className="text-faint">—</span>
          )}
        </td>
      );
    }

    // Badge cells
    if (col.cellType === 'badge') {
      return (
        <td key={col.key} className={`px-3 py-2.5 ${gb}`}>
          <BadgeDisplay value={raw as string | null} map={col.options!} colors={col.badgeColors!} />
        </td>
      );
    }

    // Select cells
    if (col.cellType === 'select') {
      return (
        <td key={col.key} className={`px-3 py-2.5 ${gb}`}>
          <SelectDisplay value={raw as string | null} options={col.options!} />
        </td>
      );
    }

    // Text cells
    if (col.cellType === 'text') {
      const strVal = (raw as string) || '';
      return (
        <td key={col.key} className={`px-3 py-2.5 ${col.maxWidth ? `max-w-[${col.maxWidth}]` : ''} ${gb}`}>
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
        <td key={col.key} className={`px-3 py-2.5 whitespace-nowrap ${gb}`}>
          <NumberDisplay value={numVal} prefix={col.prefix} suffix={col.suffix} meetsStandard={meetsStandard} />
        </td>
      );
    }

    // Date cells
    if (col.cellType === 'date') {
      const dateVal = raw as string | null;
      return (
        <td key={col.key} className={`px-3 py-2.5 text-[13px] text-muted whitespace-nowrap ${gb}`}>
          {dateVal ? new Date(dateVal).toLocaleDateString() : <span className="text-faint">—</span>}
        </td>
      );
    }

    return <td key={col.key} className={`px-3 py-2.5 text-[13px] text-muted ${gb}`}>—</td>;
  };

  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[3200px]">
        <thead className="bg-white border-b border-edge sticky top-0 z-10">
          {/* Group header row */}
          <tr>
            {COLUMN_GROUPS.map((group, i) => (
              <th
                key={i}
                colSpan={group.colSpan}
                className={`px-3 py-2.5 text-left text-[11px] font-bold text-ink uppercase tracking-wider bg-white ${i > 0 ? GROUP_BORDER : ''}`}
              >
                {group.label}
              </th>
            ))}
            <th className="w-10 bg-white" />
          </tr>
          {/* Individual column headers */}
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
              className="bg-white hover:bg-surface/50 transition-colors group cursor-pointer"
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
