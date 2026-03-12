// components/reviews/TypeFilterTabs.tsx
'use client';

import { TYPE_LABELS } from '@/lib/review-utils';
import type { ReviewItem } from '@/lib/supabase';

interface TypeFilterTabsProps {
  items: ReviewItem[];
  availableTypes: string[];
  typeFilter: string | null;
  onFilterChange: (type: string | null) => void;
  /** 'admin' = teal Tailwind classes, 'branded' = inline styles via sidebarTextColor */
  variant?: 'admin' | 'branded';
  /** Required when variant='branded' — the sidebar text color */
  sidebarTextColor?: string;
  /** Whether to show counts in tabs */
  showCounts?: boolean;
}

export default function TypeFilterTabs({
  items,
  availableTypes,
  typeFilter,
  onFilterChange,
  variant = 'admin',
  sidebarTextColor = '#ffffff',
  showCounts = true,
}: TypeFilterTabsProps) {
  if (availableTypes.length <= 1) return null;

  if (variant === 'branded') {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => onFilterChange(null)}
          className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors"
          style={{
            backgroundColor: !typeFilter ? `${sidebarTextColor}18` : 'transparent',
            color: !typeFilter ? sidebarTextColor : `${sidebarTextColor}55`,
          }}
        >
          All{showCounts ? ` (${items.length})` : ''}
        </button>
        {availableTypes.map((t) => (
          <button
            key={t}
            onClick={() => onFilterChange(t)}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors capitalize"
            style={{
              backgroundColor: typeFilter === t ? `${sidebarTextColor}18` : 'transparent',
              color: typeFilter === t ? sidebarTextColor : `${sidebarTextColor}55`,
            }}
          >
            {TYPE_LABELS[t] || t}s{showCounts ? ` (${items.filter((i) => i.type === t).length})` : ''}
          </button>
        ))}
      </div>
    );
  }

  // Admin variant — teal Tailwind classes
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onFilterChange(null)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          !typeFilter
            ? 'bg-teal/10 text-teal'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
      >
        All{showCounts ? ` (${items.length})` : ''}
      </button>
      {availableTypes.map((t) => (
        <button
          key={t}
          onClick={() => onFilterChange(t)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            typeFilter === t
              ? 'bg-teal/10 text-teal'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          {TYPE_LABELS[t] || t}s{showCounts ? ` (${items.filter((i) => i.type === t).length})` : ''}
        </button>
      ))}
    </div>
  );
}