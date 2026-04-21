'use client';

import type { FeedbackComment } from '@/lib/supabase';

interface PinOverlayProps {
  pinComments: FeedbackComment[];
  pendingPin: { x: number; y: number } | null;
  onPinClick?: (commentId?: string) => void;
}

const PIN_SIZE = 28;
const GREEN = '#16A34A';
const GREEN_RESOLVED = '#10B981';

export default function PinOverlay({
  pinComments,
  pendingPin,
  onPinClick,
}: PinOverlayProps) {
  return (
    <>
      {pinComments.map((c) => {
        const bg = c.resolved ? GREEN_RESOLVED : GREEN;
        return (
          <button
            key={c.id}
            data-pin-marker
            className="absolute z-10 rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-semibold text-white transition-transform hover:scale-110"
            style={{
              left: `${c.pin_x}%`,
              top: `${c.pin_y}%`,
              width: PIN_SIZE,
              height: PIN_SIZE,
              marginLeft: -PIN_SIZE / 2,
              marginTop: -PIN_SIZE / 2,
              backgroundColor: bg,
              opacity: c.resolved ? 0.6 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPinClick?.(c.id);
            }}
            title={`#${c.thread_number}: ${c.content.slice(0, 50)}`}
          >
            {c.thread_number || '•'}
          </button>
        );
      })}

      {pendingPin && (
        <div
          className="absolute z-10 animate-pulse rounded-full border-2 border-white shadow-md flex items-center justify-center text-sm font-bold text-white"
          style={{
            left: `${pendingPin.x}%`,
            top: `${pendingPin.y}%`,
            width: PIN_SIZE,
            height: PIN_SIZE,
            marginLeft: -PIN_SIZE / 2,
            marginTop: -PIN_SIZE / 2,
            backgroundColor: GREEN,
          }}
        >
          +
        </div>
      )}
    </>
  );
}
