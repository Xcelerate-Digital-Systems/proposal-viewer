// hooks/usePinFeedback.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { type FeedbackMode } from '@/components/reviews/feedback';

/**
 * Manages pin feedback state and drawing tool modes.
 * Pin placement is always active by default — clicking content places a pin
 * unless a drawing tool (arrow/box/text) is active.
 */
export function usePinFeedback() {
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('idle');
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Whether pin placement is active (always on unless a drawing tool is selected)
  const pinActive = feedbackMode === 'idle' || feedbackMode === 'pin';

  // Click on content to place a pin (always active unless drawing tool is selected)
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinActive) return;
    // Ignore clicks on existing pin markers
    if ((e.target as HTMLElement).closest('[data-pin-marker]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
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