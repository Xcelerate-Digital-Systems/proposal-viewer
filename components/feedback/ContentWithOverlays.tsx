'use client';

import React from 'react';
import PinOverlay from './PinOverlay';
import { HighlightOverlay } from '@/components/feedback/tools';
import type { FeedbackComment } from '@/lib/supabase';

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface ContentWithOverlaysProps {
  children: React.ReactNode;
  /** Ref forwarded to the wrapper div (used for pin positioning + highlight DOM queries) */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** CSS cursor for the content surface */
  cursorStyle?: string;
  /** Click handler for placing pins */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Additional className for the wrapper div */
  className?: string;

  // ── Pin overlay ──
  pinComments: FeedbackComment[];
  pendingPin: { x: number; y: number } | null;
  onPinClick: (commentId?: string) => void;

  // ── Highlight overlay (optional — only for content types with highlightable text) ──
  /** When true, render the HighlightOverlay. Defaults to false. */
  withHighlights?: boolean;
  highlightComments?: FeedbackComment[];
  highlightedCommentId?: string | null;
  onHighlightClick?: (commentId: string) => void;
  pendingHighlight?: { start: number; end: number } | null;
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

/**
 * Wraps mockup content with PinOverlay (always) and HighlightOverlay
 * (when `withHighlights` is true). Provides the common container setup:
 * relative positioning, ref forwarding, cursor, and click handler.
 */
export default function ContentWithOverlays({
  children,
  containerRef,
  cursorStyle = 'default',
  onClick,
  className = '',
  pinComments,
  pendingPin,
  onPinClick,
  withHighlights = false,
  highlightComments = [],
  highlightedCommentId,
  onHighlightClick,
  pendingHighlight,
}: ContentWithOverlaysProps) {
  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ cursor: cursorStyle }}
      onClick={onClick}
    >
      {children}
      <PinOverlay
        pinComments={pinComments}
        pendingPin={pendingPin}
        onPinClick={onPinClick}
      />
      {withHighlights && (
        <HighlightOverlay
          containerRef={containerRef as React.RefObject<HTMLElement | null>}
          highlightComments={highlightComments}
          highlightedCommentId={highlightedCommentId}
          onHighlightClick={onHighlightClick}
          pendingHighlight={pendingHighlight}
        />
      )}
    </div>
  );
}
