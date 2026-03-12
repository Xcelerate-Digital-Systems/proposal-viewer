// components/reviews/feedback/HighlightOverlay.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ReviewComment } from '@/lib/supabase';

interface HighlightOverlayProps {
  /** The container element containing the highlightable HTML content */
  containerRef: React.RefObject<HTMLElement>;
  /** Comments with text_highlight comment_type */
  highlightComments: ReviewComment[];
  /** Currently highlighted comment ID (for pulse effect) */
  highlightedCommentId?: string | null;
  /** Click a highlight → navigate to comment */
  onHighlightClick?: (commentId: string) => void;
}

/**
 * Finds the text node and offset within a container at a given flat character offset.
 */
function findNodeAtOffset(
  container: HTMLElement,
  targetOffset: number
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let accumulated = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const len = node.textContent?.length || 0;
    if (accumulated + len > targetOffset) {
      return { node, offset: targetOffset - accumulated };
    }
    accumulated += len;
  }

  return null;
}

/**
 * Renders <mark> highlights over previously commented text ranges.
 * Uses DOM manipulation to wrap text ranges after the container renders.
 */
export default function HighlightOverlay({
  containerRef,
  highlightComments,
  highlightedCommentId,
  onHighlightClick,
}: HighlightOverlayProps) {
  const marksRef = useRef<HTMLElement[]>([]);

  const applyHighlights = useCallback(() => {
    // Clean up previous marks
    for (const mark of marksRef.current) {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
      }
    }
    marksRef.current = [];

    const container = containerRef.current;
    if (!container || highlightComments.length === 0) return;

    // Sort by start offset descending so wrapping doesn't shift earlier offsets
    const sorted = [...highlightComments]
      .filter((c) => c.highlight_start != null && c.highlight_end != null)
      .sort((a, b) => (b.highlight_start ?? 0) - (a.highlight_start ?? 0));

    for (const comment of sorted) {
      const start = comment.highlight_start!;
      const end = comment.highlight_end!;

      const startPos = findNodeAtOffset(container, start);
      const endPos = findNodeAtOffset(container, end);

      if (!startPos || !endPos) continue;

      try {
        const range = document.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);

        const mark = document.createElement('mark');
        mark.className = `review-highlight cursor-pointer transition-all duration-200 ${
          comment.id === highlightedCommentId
            ? 'bg-teal/30 ring-2 ring-teal ring-offset-1 animate-pulse'
            : 'bg-teal/15 hover:bg-teal/25'
        }`;
        mark.dataset.commentId = comment.id;
        mark.title = comment.highlight_text || '';

        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          onHighlightClick?.(comment.id);
        });

        range.surroundContents(mark);
        marksRef.current.push(mark);
      } catch {
        // surroundContents can fail if range spans across element boundaries
        // In that case, we skip this highlight silently
      }
    }
  }, [containerRef, highlightComments, highlightedCommentId, onHighlightClick]);

  useEffect(() => {
    // Small delay to ensure the container content has rendered
    const timer = setTimeout(applyHighlights, 100);
    return () => {
      clearTimeout(timer);
      // Cleanup marks on unmount
      for (const mark of marksRef.current) {
        const parent = mark.parentNode;
        if (parent) {
          while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
          }
          parent.removeChild(mark);
          parent.normalize();
        }
      }
      marksRef.current = [];
    };
  }, [applyHighlights]);

  // This component doesn't render any React DOM — it manipulates the container directly
  return null;
}
