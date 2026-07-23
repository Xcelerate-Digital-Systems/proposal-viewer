'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { FeedbackComment } from '@/lib/supabase';

interface HighlightOverlayProps {
  /** The container element containing the highlightable HTML content */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Comments with text_highlight comment_type */
  highlightComments: FeedbackComment[];
  /** Currently highlighted comment ID (for pulse effect) */
  highlightedCommentId?: string | null;
  /** Click a highlight → navigate to comment */
  onHighlightClick?: (commentId: string) => void;
  /**
   * Pending (in-progress) highlight — the reviewer just selected text and
   * is composing a comment. Rendered in teal so it visually persists even
   * after the textarea steals focus and collapses the browser selection.
   */
  pendingHighlight?: { start: number; end: number } | null;
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
 * Wraps a Range in one or more <mark> elements. Uses surroundContents for
 * single-element ranges; falls back to per-text-node wrapping when the range
 * spans element boundaries (which causes surroundContents to throw).
 *
 * Returns the created mark elements (one for same-element, multiple for
 * cross-boundary). All marks share the same className, style, and dataset so
 * they behave as a single logical highlight.
 */
function wrapRangeWithMarks(
  range: Range,
  createMark: () => HTMLElement
): HTMLElement[] {
  // Fast path: try surroundContents first (works when range doesn't cross boundaries)
  try {
    const mark = createMark();
    range.surroundContents(mark);
    return [mark];
  } catch {
    // Range spans element boundaries — wrap each text node segment individually
  }

  const marks: HTMLElement[] = [];
  // Collect text nodes intersected by the range using a TreeWalker scoped to
  // the range's common ancestor.
  const ancestor = range.commonAncestorContainer;
  const root = ancestor.nodeType === Node.ELEMENT_NODE
    ? (ancestor as HTMLElement)
    : ancestor.parentElement!;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  // Gather all text nodes within the range first to avoid mutating the DOM
  // while iterating.
  const textNodes: { node: Text; startIdx: number; endIdx: number }[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const len = textNode.length;
    if (len === 0) continue;

    // Check if this text node is (partially) inside the range
    if (range.comparePoint(textNode, 0) > 0) continue; // node is after range end
    if (range.comparePoint(textNode, len) < 0) continue; // node is before range start

    // Determine the sub-range within this text node
    let startIdx = 0;
    let endIdx = len;

    if (textNode === range.startContainer) {
      startIdx = range.startOffset;
    }
    if (textNode === range.endContainer) {
      endIdx = range.endOffset;
    }
    if (startIdx >= endIdx) continue;

    textNodes.push({ node: textNode, startIdx, endIdx });
  }

  // Wrap each text segment in its own <mark>
  for (const { node: textNode, startIdx, endIdx } of textNodes) {
    const segmentRange = document.createRange();
    segmentRange.setStart(textNode, startIdx);
    segmentRange.setEnd(textNode, endIdx);

    const mark = createMark();
    segmentRange.surroundContents(mark);
    marks.push(mark);
  }

  return marks;
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
  pendingHighlight,
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
    if (!container || (highlightComments.length === 0 && !pendingHighlight)) return;

    // Build a unified list of ranges to render. Pending highlight gets a
    // teal mark; saved comments get the yellow markup.io look. Sort by
    // start offset descending so wrapping earlier ranges doesn't shift the
    // offsets of later ones.
    type RenderRange =
      | { kind: 'comment'; start: number; end: number; comment: FeedbackComment }
      | { kind: 'pending'; start: number; end: number };

    const ranges: RenderRange[] = [];
    for (const c of highlightComments) {
      if (c.highlight_start != null && c.highlight_end != null) {
        ranges.push({ kind: 'comment', start: c.highlight_start, end: c.highlight_end, comment: c });
      }
    }
    if (pendingHighlight) {
      ranges.push({ kind: 'pending', start: pendingHighlight.start, end: pendingHighlight.end });
    }
    const sorted = ranges.sort((a, b) => b.start - a.start);

    for (const r of sorted) {
      const start = r.start;
      const end = r.end;
      if (r.kind === 'pending') {
        const startPos = findNodeAtOffset(container, start);
        const endPos = findNodeAtOffset(container, end);
        if (!startPos || !endPos) continue;
        const range = document.createRange();
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);

        const pendingMarks = wrapRangeWithMarks(range, () => {
          const mark = document.createElement('mark');
          mark.className = 'review-highlight-pending';
          Object.assign(mark.style, {
            backgroundColor: 'rgba(254, 240, 138, 0.7)',
            color: 'inherit',
            padding: '1px 2px',
            borderRadius: '2px',
          } as Partial<CSSStyleDeclaration>);
          return mark;
        });
        marksRef.current.push(...pendingMarks);
        continue;
      }

      const comment = r.comment;

      const startPos = findNodeAtOffset(container, start);
      const endPos = findNodeAtOffset(container, end);

      if (!startPos || !endPos) continue;

      const range = document.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);

      const isActive = comment.id === highlightedCommentId;
      const commentMarks = wrapRangeWithMarks(range, () => {
        const mark = document.createElement('mark');
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
        return mark;
      });

      // Append the numbered badge only to the LAST mark element so it sits
      // at the end of the highlight inline with the wrapped text.
      if (comment.thread_number != null && commentMarks.length > 0) {
        const lastMark = commentMarks[commentMarks.length - 1];
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
        lastMark.appendChild(badge);
      }

      marksRef.current.push(...commentMarks);
    }
  }, [containerRef, highlightComments, highlightedCommentId, onHighlightClick, pendingHighlight]);

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
