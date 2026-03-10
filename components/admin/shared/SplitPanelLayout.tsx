// components/admin/shared/SplitPanelLayout.tsx
'use client';

import { RefObject } from 'react';

interface SplitPanelLayoutProps {
  /** Tool/editor column (65%) */
  left: React.ReactNode;
  /** Preview column (35%). When omitted, left fills full width. */
  right?: React.ReactNode;
  /** Optional ref for height measurement */
  containerRef?: RefObject<HTMLDivElement>;
  /** Explicit height from measurement hook */
  panelHeight?: number;
  /** Extra classes for the left column */
  leftClassName?: string;
  /** Extra classes for the right column */
  rightClassName?: string;
  /** Gap between columns — defaults to gap-6 */
  gap?: 'gap-5' | 'gap-6';
}

export default function SplitPanelLayout({
  left,
  right,
  containerRef,
  panelHeight,
  leftClassName = '',
  rightClassName = '',
  gap = 'gap-6',
}: SplitPanelLayoutProps) {
  return (
    <div
      ref={containerRef}
      className={`flex ${gap}`}
      style={panelHeight ? { height: panelHeight } : undefined}
    >
      <div className={`${right ? 'w-[65%] px-2' : 'flex-1'} min-w-0 ${leftClassName}`}>
        {left}
      </div>
      {right && (
        <div className={`w-[35%] shrink-0 ${rightClassName}`}>
          {right}
        </div>
      )}
    </div>
  );
}