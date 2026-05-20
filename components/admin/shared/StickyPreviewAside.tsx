// components/admin/shared/StickyPreviewAside.tsx
// Right-column sticky preview shell used by every builder tab (Cover, Design,
// Quote, Pricing, Packages, Text Pages, TOC, Page Editor). Standardises the
// width breakpoints and `sticky top-6` offset so future tweaks land in one
// place instead of 12 files.
//
// Most callers pass plain preview JSX and let this component handle stickiness
// (default). A few callers (PreviewPane in the quote builder) manage their own
// `sticky` + `max-h` internally — those pass `sticky={false}` to opt out of
// the inner wrapper.

import type { ReactNode } from 'react';

interface StickyPreviewAsideProps {
  children: ReactNode;
  /** Wrap children in `<div className="sticky top-6">`. Set false when the
   *  child component already positions itself sticky. Default: true. */
  sticky?: boolean;
}

export default function StickyPreviewAside({
  children,
  sticky = true,
}: StickyPreviewAsideProps) {
  return (
    <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
      {sticky ? <div className="sticky top-6">{children}</div> : children}
    </aside>
  );
}
