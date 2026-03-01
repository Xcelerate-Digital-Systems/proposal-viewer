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
          className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-[11px] font-bold shadow-lg z-10 border-2 border-white transition-transform hover:scale-110 ${
            c.resolved
              ? 'bg-gray-400 opacity-50'
              : 'bg-green-500 text-white'
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
          className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-[11px] font-bold shadow-lg animate-pulse z-10 border-2 border-white bg-green-500 text-white"
          style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
        >
          +
        </div>
      )}
    </>
  );
}