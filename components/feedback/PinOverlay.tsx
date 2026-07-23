'use client';

import { useState } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import type { FeedbackComment } from '@/lib/supabase';

interface PinOverlayProps {
  pinComments: FeedbackComment[];
  pendingPin: { x: number; y: number } | null;
  onPinClick?: (commentId?: string) => void;
}

const PIN_SIZE = 28;
const GREEN = '#16A34A';
const RESOLVED_GRAY = '#94A3B8';

export default function PinOverlay({
  pinComments,
  pendingPin,
  onPinClick,
}: PinOverlayProps) {
  const [showResolved, setShowResolved] = useState(false);

  const hasResolved = pinComments.some((c) => c.resolved);

  return (
    <>
      {/* Show resolved toggle — only render when there are resolved pins */}
      {hasResolved && (
        <button
          data-pin-marker
          data-no-pin
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowResolved((v) => !v);
          }}
          className="absolute z-20 top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors bg-black/60 hover:bg-black/75 text-white/90 backdrop-blur-sm"
          title={showResolved ? 'Hide resolved pins' : 'Show resolved pins'}
        >
          {showResolved ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          Resolved
        </button>
      )}

      {pinComments.map((c) => {
        // Hide resolved pins unless toggle is on
        if (c.resolved && !showResolved) return null;

        const isResolved = c.resolved;

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
              backgroundColor: isResolved ? RESOLVED_GRAY : GREEN,
              opacity: isResolved ? 0.7 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPinClick?.(c.id);
            }}
            title={`#${c.thread_number}: ${c.content.slice(0, 50)}${isResolved ? ' (resolved)' : ''}`}
          >
            {isResolved ? (
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            ) : (
              c.thread_number || '•'
            )}
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
