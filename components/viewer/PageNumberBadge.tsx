// components/viewer/PageNumberBadge.tsx
'use client';

import { fontFamily as resolveFontFamily } from '@/lib/google-fonts';

interface PageNumberBadgeProps {
  currentPage: number;
  totalPages: number;
  /** @deprecated use circleColor instead */
  accentColor?: string;
  /** Override colour for the circle background (falls back to accentColor) */
  circleColor?: string;
  /** Override colour for the page number text (default: #ffffff) */
  textColor?: string;
  /** Branded body font name (e.g. branding.font_body) */
  font?: string | null;
}

export default function PageNumberBadge({
  currentPage,
  totalPages,
  accentColor = '#01434A',
  circleColor,
  textColor = '#ffffff',
  font,
}: PageNumberBadgeProps) {
  const bg = circleColor ?? accentColor;
  const ff = resolveFontFamily(font, 'system-ui, sans-serif');

  return (
    <div className="absolute bottom-0 right-0 z-10 pointer-events-none select-none">
      <div
        className="relative flex items-center justify-center"
        style={{ width: 60, height: 60 }}
      >
        <div
          className="absolute bottom-0 right-0 rounded-tl-full"
          style={{
            width: 70,
            height: 70,
            backgroundColor: bg,
            opacity: 0.9,
          }}
        />
        <span
          className="relative font-bold"
          style={{ color: textColor, fontSize: 13, fontFamily: ff }}
        >
          {currentPage}
        </span>
      </div>
    </div>
  );
}