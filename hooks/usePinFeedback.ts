// hooks/usePinFeedback.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import { type FeedbackMode } from '@/components/reviews/feedback';

/**
 * Manages pin feedback state: mode toggling, pending pin coordinates,
 * and image click-to-pin handler.
 * Replaces identical logic duplicated across review/project/admin item detail pages.
 */
export function usePinFeedback() {
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('idle');
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Click on image/ad to place a pin (only active in pin mode)
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (feedbackMode !== 'pin') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setFeedbackMode('idle');
  }, [feedbackMode]);

  // Clicking an existing pin — surface for parent to open comments
  const handlePinClick = useCallback(() => {
    // Parent typically calls setShowComments(true) in response
  }, []);

  // Cancel pending pin placement
  const handleCancelPin = useCallback(() => {
    setPendingPin(null);
  }, []);

  // Change feedback mode, clearing pin if switching away from pin mode
  const changeFeedbackMode = useCallback((mode: FeedbackMode) => {
    setFeedbackMode(mode);
    if (mode !== 'pin') setPendingPin(null);
  }, []);

  // Reset state (e.g. when navigating to a different item)
  const resetFeedback = useCallback(() => {
    setPendingPin(null);
    setFeedbackMode('idle');
  }, []);

  return {
    feedbackMode,
    setFeedbackMode,
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