'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { FeedbackComment } from '@/lib/supabase';

interface HighlightOverlayProps {
  /** The container element containing the highlightable HTML content */
  containerRef: React.RefObject<HTMLElement>;
  /** Comments with text_highlight comment_type */
  highlightComments: FeedbackComment[];
  /** Currently highlighted comment ID (for pulse effect) */
  highlightedCommentId?: string | null;
  /** Click a highlight → navigate to comment */
  onHighlightClick?: (commentId: string) => void;
}

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
 * Renders <mark> highlights over previously commented text ranges with a
 * numbered badge inside each mark (markup.io-style). Clicking either the
 * text or the badge invokes onHighlightClick.
 */
export default function HighlightOverlay({
  containerRef,
  highlightComments,
  highlightedCommentId,
  onHighlightClick,
}: HighlightOverlayProps) {
  const marksRef = useRef<HTMLElement[]>([]);

  const applyHighlights = useCallback(() => {
    for (const mark of marksRef.current) {
      const parent = mark.parentNode;
      if (parent) {
        mark.querySelectorAll('.review-highlight-badge').forEach((b) => b.remove());
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

    // Sort by start offset descending so wrapping earlier ranges doesn't
    // shift the offsets of later ones.
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
        const isActive = comment.id === highlightedCommentId;
        mark.className = `review-highlight cursor-pointer transition-all duration-200 ${
          isActive
            ? 'bg-yellow-300/60 ring-2 ring-yellow-400 ring-offset-1 animate-pulse'
            : 'bg-yellow-200/70 hover:bg-yellow-300/80'
        }`;
        mark.style.padding = '1px 2px';
        mark.style.borderRadius = '2px';
        mark.dataset.commentId = comment.id;
        mark.title = comment.highlight_text || '';

        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          onHighlightClick?.(comment.id);
        });

        range.surroundContents(mark);

        // Append a numbered badge as the last child of the mark so it sits
        // at the end of the highlight inline with the wrapped text.
        if (comment.thread_number != null) {
          const badge = document.createElement('span');
          badge.className = 'review-highlight-badge';
          badge.textContent = String(comment.thread_number);
          badge.setAttribute('contenteditable', 'false');
          Object.assign(badge.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            marginLeft: '3px',
            borderRadius: '9999px',
            background: '#017C87',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: '700',
            lineHeight: '1',
            verticalAlign: 'middle',
            cursor: 'pointer',
            userSelect: 'none',
            fontStyle: 'normal',
          } as Partial<CSSStyleDeclaration>);
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            onHighlightClick?.(comment.id);
          });
          mark.appendChild(badge);
        }

        marksRef.current.push(mark);
      } catch {
        // surroundContents fails if the range spans element boundaries; skip.
      }
    }
  }, [containerRef, highlightComments, highlightedCommentId, onHighlightClick]);

  useEffect(() => {
    const timer = setTimeout(applyHighlights, 100);
    return () => {
      clearTimeout(timer);
      for (const mark of marksRef.current) {
        mark.querySelectorAll('.review-highlight-badge').forEach((b) => b.remove());
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

  return null;
}
