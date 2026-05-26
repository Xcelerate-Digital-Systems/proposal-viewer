// components/ui/EmptyState.tsx
// Canonical "this list is empty / this is your first time here" UI. Replaces
// ~6 hand-rolled empty-state divs across the list pages that all rendered
// the same shape (icon-on-surface-swatch + title + description + primary CTA)
// with drifty margins and button sizes.
//
// Use this on top-level list pages whenever the underlying collection is
// empty for a reason other than a search filter -- for search misses use
// <NoResults> instead.
'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** A `<Button>` element (or `<Link>` styled via buttonClasses) — usually
   *  the same CTA that lives in the page header, e.g. "+ New Pitch". */
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-20 ${className}`}>
      <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon size={28} className="text-faint" />
      </div>
      <h3 className="text-lg font-semibold text-muted mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-faint max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export { EmptyState };
