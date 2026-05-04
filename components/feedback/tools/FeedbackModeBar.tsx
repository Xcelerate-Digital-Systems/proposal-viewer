'use client';

import type { FeedbackMode } from './FeedbackToolbar';

interface FeedbackModeBarProps {
  /** Current active mode */
  mode: FeedbackMode;
  /** Cancel the current mode */
  onCancel: () => void;
  /** Brand accent color — applied to the bar background. Defaults to teal. */
  accentColor?: string;
}

const MODE_MESSAGES: Partial<Record<FeedbackMode, string>> = {
  screenshot: 'Capturing screenshot…',
};

export default function FeedbackModeBar({ mode, onCancel, accentColor }: FeedbackModeBarProps) {
  const message = MODE_MESSAGES[mode];
  if (!message) return null;

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2.5 text-white text-[13px] font-medium z-40 shrink-0 animate-in slide-in-from-top duration-200 shadow-[0_1px_0_rgba(0,0,0,0.06)]"
      style={{ backgroundColor: accentColor || '#017C87' }}
    >
      <span>{message}</span>
      <button
        onClick={onCancel}
        className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-[12px] font-medium transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}