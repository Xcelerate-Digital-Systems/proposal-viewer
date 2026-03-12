// components/reviews/feedback/FeedbackModeBar.tsx
'use client';

import type { FeedbackMode } from './FeedbackToolbar';

interface FeedbackModeBarProps {
  /** Current active mode */
  mode: FeedbackMode;
  /** Cancel the current mode */
  onCancel: () => void;
}

const MODE_MESSAGES: Partial<Record<FeedbackMode, string>> = {
  arrow: 'Click and drag to draw an arrow',
  box: 'Click and drag to draw a rectangle',
  text: 'Click anywhere to add a text box',
  screenshot: 'Capturing screenshot…',
};

export default function FeedbackModeBar({ mode, onCancel }: FeedbackModeBarProps) {
  const message = MODE_MESSAGES[mode];
  if (!message) return null;

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-teal text-white text-sm font-medium shadow-md z-40 shrink-0 animate-in slide-in-from-top duration-200">
      <span className="text-[13px]">{message}</span>
      <button
        onClick={onCancel}
        className="px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 text-[12px] font-medium transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}