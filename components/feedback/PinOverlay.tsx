'use client';

import type { FeedbackComment } from '@/lib/supabase';
import { SketchyPin } from './sketchy/SketchyPin';
import { hashStringToInt } from './sketchy/seed';

interface PinOverlayProps {
  pinComments: FeedbackComment[];
  pendingPin: { x: number; y: number } | null;
  onPinClick?: (commentId?: string) => void;
}

const PIN_SIZE = 32;

export default function PinOverlay({
  pinComments,
  pendingPin,
  onPinClick,
}: PinOverlayProps) {
  return (
    <>
      {pinComments.map((c) => {
        const seed = hashStringToInt(c.id);
        const fill = c.resolved ? '#10B981' : '#017C87';
        return (
          <button
            key={c.id}
            data-pin-marker
            className="absolute z-10 transition-transform hover:scale-110"
            style={{
              left: `${c.pin_x}%`,
              top: `${c.pin_y}%`,
              width: PIN_SIZE,
              height: PIN_SIZE,
              marginLeft: -PIN_SIZE / 2,
              marginTop: -PIN_SIZE / 2,
              opacity: c.resolved ? 0.55 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPinClick?.(c.id);
            }}
            title={`#${c.thread_number}: ${c.content.slice(0, 50)}`}
          >
            <SketchyPin size={PIN_SIZE} seed={seed} fill={fill} strokeWidth={1.8} />
            <span className="relative z-10 flex items-center justify-center w-full h-full font-hand text-sm font-bold text-white">
              {c.thread_number || '•'}
            </span>
          </button>
        );
      })}

      {pendingPin && (
        <div
          className="absolute z-10 animate-pulse"
          style={{
            left: `${pendingPin.x}%`,
            top: `${pendingPin.y}%`,
            width: PIN_SIZE,
            height: PIN_SIZE,
            marginLeft: -PIN_SIZE / 2,
            marginTop: -PIN_SIZE / 2,
          }}
        >
          <SketchyPin size={PIN_SIZE} seed={1} fill="#017C87" strokeWidth={1.8} />
          <span className="relative z-10 flex items-center justify-center w-full h-full font-hand text-lg font-bold text-white">
            +
          </span>
        </div>
      )}
    </>
  );
}
