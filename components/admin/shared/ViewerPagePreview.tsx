// components/admin/shared/ViewerPagePreview.tsx
// Universal scaled preview wrapper for viewer page components (pricing, packages, TOC).
// Standardises: 1200px logical width, minHeight 100vh, ViewerBackground, GoogleFontLoader,
// and the header/footer chrome — so all previews render identically.
'use client';

import { useRef, useState, useEffect } from 'react';
import { CompanyBranding } from '@/hooks/useProposal';
import ViewerBackground from '@/components/viewer/ViewerBackground';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Logical width the page components are rendered at before scaling.
 *  1200px ensures lg: breakpoints (1024px) always fire, matching the live viewer. */
const LOGICAL_WIDTH = 1200;
const MAX_SCALE = 0.55;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ViewerPagePreviewProps {
  branding: CompanyBranding;
  /** Text shown on the right of the header bar (e.g. page title) */
  label?: string;
  /** Icon shown beside label in the header bar */
  icon?: React.ReactNode;
  /** Text shown in the footer bar */
  footer?: string;
  /** When provided, replaces the scaled content area entirely.
   *  Use for empty states so we don't render page components with no data. */
  emptyState?: React.ReactNode;
  children: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ViewerPagePreview({
  branding,
  label,
  icon,
  footer,
  emptyState,
  children,
}: ViewerPagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MAX_SCALE);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(Math.min(MAX_SCALE, width / LOGICAL_WIDTH));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-0 sticky top-0 self-start w-full"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    >
      <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-gray-100 min-h-0">

        {/* Header */}
        <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Live Preview</span>
          {(icon || label) && (
            <span className="text-xs text-teal font-medium flex items-center gap-1">
              {icon}{label}
            </span>
          )}
        </div>

        {/* Scaled content area */}
        <div className="flex-1 min-h-[400px] overflow-hidden relative">
          {emptyState ?? (
            <div
              className="absolute inset-0 overflow-y-auto"
              style={{
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
                width: `${100 / scale}%`,
                height: `${100 / scale}%`,
              }}
            >
              <GoogleFontLoader fonts={[branding.font_body, branding.font_heading, branding.title_font_family]} />
              <div
                className="relative w-full"
                style={{
                  backgroundColor: branding.bg_primary || '#0f0f0f',
                  minHeight: '100vh',
                }}
              >
                <ViewerBackground branding={branding} />
                <div className="relative">{children}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-center">
            <span className="text-[10px] text-gray-400">{footer}</span>
          </div>
        )}

      </div>
    </div>
  );
}
