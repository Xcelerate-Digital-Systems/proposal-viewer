// components/viewer/PageNumberBadge.tsx
'use client';

interface PageNumberBadgeProps {
  currentPage: number;
  totalPages: number;
  /** @deprecated use circleColor instead */
  accentColor?: string;
  /** Override colour for the circle background (falls back to accentColor) */
  circleColor?: string;
  /** Override colour for the page number text (default: #ffffff) */
  textColor?: string;
}

export default function PageNumberBadge({
  currentPage,
  totalPages,
  accentColor = '#01434A',
  circleColor,
  textColor = '#ffffff',
}: PageNumberBadgeProps) {
  const bg = circleColor ?? accentColor;

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
          className="relative font-bold text-md"
          style={{ color: textColor }}
        >
          {currentPage}
        </span>
      </div>
    </div>
  );
}