// components/reviews/PinOverlay.tsx
'use client';

import type { ReviewComment } from '@/lib/supabase';

interface PinOverlayProps {
  /** Top-level pin comments to display */
  pinComments: ReviewComment[];
  /** Pending pin position (not yet submitted) */
  pendingPin: { x: number; y: number } | null;
  /** Callback when a pin marker is clicked */
  onPinClick?: () => void;
}

export default function PinOverlay({
  pinComments,
  pendingPin,
  onPinClick,
}: PinOverlayProps) {
  return (
    <>
      {/* Existing pin markers */}
      {pinComments.map((c) => (
        <button
          key={c.id}
          className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg z-10 transition-transform hover:scale-110 ${
            c.resolved
              ? 'bg-gray-400 opacity-50'
              : 'bg-[#017C87] text-white'
          }`}
          style={{ left: `${c.pin_x}%`, top: `${c.pin_y}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onPinClick?.();
          }}
          title={`#${c.thread_number}: ${c.content.slice(0, 50)}`}
        >
          {c.thread_number || '•'}
        </button>
      ))}

      {/* Pending pin (not yet submitted) */}
      {pendingPin && (
        <div
          className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg animate-pulse z-10 bg-[#017C87] text-white"
          style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
        >
          +
        </div>
      )}
    </>
  );
}