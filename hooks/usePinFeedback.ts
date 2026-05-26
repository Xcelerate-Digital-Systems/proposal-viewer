// hooks/usePinFeedback.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { type FeedbackMode } from '@/components/feedback/tools';

/**
 * Manages pin feedback state and drawing tool modes.
 * Pin placement is always active by default — clicking content places a pin
 * unless a drawing tool (arrow/box/text) is active.
 */
/** Pin click target. 'creative' = click landed inside a `[data-creative]`
 *  element (e.g. the Meta ad's image) → pin should be variant-independent so
 *  feedback on the creative shows on every variant. Anything else (including
 *  undefined) means the click was on text/UI and the pin scopes to whatever
 *  the active view is at submit time. */
export type PinTarget = 'creative' | undefined;

export type PendingPin = { x: number; y: number; target?: PinTarget };

export function usePinFeedback() {
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('idle');
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Whether pin placement is active (always on unless a drawing tool is selected)
  const pinActive = feedbackMode === 'idle' || feedbackMode === 'pin';

  // Click on content to place a pin (always active unless drawing tool is selected)
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinActive) return;
    const target = e.target as HTMLElement;
    // Ignore clicks on existing pin markers
    if (target.closest('[data-pin-marker]')) return;
    // Ignore clicks on interactive controls (email client toggle, links, form
    // elements, anything explicitly opted out with data-no-pin). Without this,
    // a click on the Inbox/Email toggle bubbles up and drops a stray pin.
    if (target.closest('button, a, input, select, textarea, label, [role="button"], [data-no-pin]')) return;
    // Ignore the tail end of a text-selection drag — if the user just finished
    // selecting text, the synthesised click shouldn't also drop a pin, and
    // dropping one here would unmount the selection popover before it can be
    // used.
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    // Snapshot whether the click landed inside a creative element (e.g. the
    // Meta ad image). Stored on the pending pin so the submit handler can
    // stamp creative pins with a shared view that survives variant switches.
    const isCreative = !!target.closest('[data-creative]');
    setPendingPin({ x, y, target: isCreative ? 'creative' : undefined });
  }, [pinActive]);

  // Clicking an existing pin — parent uses this to scroll to comment
  const handlePinClick = useCallback((_commentId?: string) => {
    // Parent typically calls setShowComments(true) + setHighlightedCommentId in response
  }, []);

  // Cancel pending pin placement
  const handleCancelPin = useCallback(() => {
    setPendingPin(null);
  }, []);

  // Change feedback mode (for drawing tools), clearing pending pin
  const changeFeedbackMode = useCallback((mode: FeedbackMode) => {
    setFeedbackMode(mode);
    setPendingPin(null);
  }, []);

  // Reset state (e.g. when navigating to a different item)
  const resetFeedback = useCallback(() => {
    setPendingPin(null);
    setFeedbackMode('idle');
  }, []);

  return {
    feedbackMode,
    setFeedbackMode,
    pinActive,
    pendingPin,
    setPendingPin,
    imageContainerRef,
    handleImageClick,
    handlePinClick,
    handleCancelPin,
    changeFeedbackMode,
    resetFeedback,
  };
}