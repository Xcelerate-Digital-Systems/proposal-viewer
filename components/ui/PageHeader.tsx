// components/ui/PageHeader.tsx
// Canonical page header for list and detail pages. Replaces ~15 hand-rolled
// header divs that each picked their own combination of:
//   - tracking-tight or not on the h1
//   - mb-4 spacing between header row and (optional) tabs/filter strip below
//   - flex-1 + min-w-0 on the title block to keep long titles from pushing
//     out the action buttons
//   - shadow-divider on the wrapper
//
// Common case — title + description + a primary CTA on the right:
//
//   <PageHeader title="Pitch Studio" description="6 active pitches"
//               actions={<Button leftIcon={Plus}>+ New Pitch</Button>} />
//
// With a filter strip / tabs below:
//
//   <PageHeader title="Markup" description="..." actions={...}>
//     <ProjectFilterTabs ... />
//   </PageHeader>
//
'use client';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Right-aligned action slot in the same row as the title. Usually one or
   *  more <Button> elements (the primary CTA + view-mode toggles, etc.). */
  actions?: ReactNode;
  /** Optional content rendered below the title row, inside the same shadow-
   *  divider container. Typical use: a horizontal tab strip or filter row. */
  children?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  actions,
  children,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`bg-ivory shadow-divider px-6 lg:px-10 py-4 ${className}`}>
      <div className={`flex items-center gap-4 ${children ? 'mb-4' : ''}`}>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && (
            <p className="text-sm text-muted mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export { PageHeader };
