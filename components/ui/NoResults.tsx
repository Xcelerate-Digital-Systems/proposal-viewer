// components/ui/NoResults.tsx
// "No matches" UI for search/filter misses. Distinct from <EmptyState> (which
// is for "the underlying list is genuinely empty"); this is for "the list
// has items but none match the current filter/search". Smaller and quieter.
//
// Typical use:
//   {filtered.length === 0 && searchQuery ? (
//     <NoResults message={`No pitches matching "${searchQuery}"`} />
//   ) : items.length === 0 ? (
//     <EmptyState ... />
//   ) : ...}
'use client';

import { Search, type LucideIcon } from 'lucide-react';

interface NoResultsProps {
  message: string;
  /** Defaults to a Search icon — pass another LucideIcon for non-search
   *  filter misses (e.g. Filter for active/archived filters). */
  icon?: LucideIcon;
  className?: string;
}

export default function NoResults({
  message,
  icon: Icon = Search,
  className = '',
}: NoResultsProps) {
  return (
    <div className={`text-center py-20 ${className}`}>
      <Icon size={28} className="text-faint mx-auto mb-3" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export { NoResults };
