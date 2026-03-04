// components/viewer/PageNumberBadge.tsx
'use client';

interface PageNumberBadgeProps {
  currentPage: number;
  totalPages: number;
  accentColor?: string;
}

export default function PageNumberBadge({
  currentPage,
  totalPages,
  accentColor = '#ff6700',
}: PageNumberBadgeProps) {
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
            backgroundColor: accentColor,
            opacity: 0.9,
          }}
        />
        <span
          className="relative font-bold text-md"
          style={{ color: '#ffffff' }}
        >
          {currentPage}
        </span>
      </div>
    </div>
  );
}