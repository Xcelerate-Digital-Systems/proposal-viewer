// components/admin/ads/AdFilterBar.tsx
'use client';

import type { AdCreativeFilters } from '@/hooks/useAdCreatives';
import {
  AD_CREATIVE_STATUSES,
  AD_WINNER_STATUSES,
  AD_MEDIA_TYPES,
  AWARENESS_LEVELS,
} from '@/lib/ad-tracker/constants';

type Props = {
  filters: AdCreativeFilters;
  onChange: (updates: Partial<AdCreativeFilters>) => void;
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (val: string | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="bg-surface border border-edge rounded-lg px-2.5 py-1.5 text-[13px] text-ink outline-none focus:ring-2 focus:ring-teal/20 min-w-[130px]"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdFilterBar({ filters, onChange }: Props) {
  return (
    <div className="flex items-end gap-4 mt-4 flex-wrap">
      <FilterSelect
        label="Status"
        value={filters.status}
        options={AD_CREATIVE_STATUSES}
        onChange={(status) => onChange({ status })}
      />
      <FilterSelect
        label="Winner"
        value={filters.winner}
        options={AD_WINNER_STATUSES}
        onChange={(winner) => onChange({ winner })}
      />
      <FilterSelect
        label="Media"
        value={filters.media_type}
        options={AD_MEDIA_TYPES}
        onChange={(media_type) => onChange({ media_type })}
      />
      <FilterSelect
        label="Awareness"
        value={filters.awareness_level}
        options={AWARENESS_LEVELS}
        onChange={(awareness_level) => onChange({ awareness_level })}
      />

      {(filters.status || filters.winner || filters.media_type || filters.awareness_level) && (
        <button
          onClick={() => onChange({ status: undefined, winner: undefined, media_type: undefined, awareness_level: undefined })}
          className="text-[13px] text-teal hover:underline pb-1.5"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
