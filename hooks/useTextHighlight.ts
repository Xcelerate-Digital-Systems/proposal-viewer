// hooks/useTextHighlight.ts
'use client';

import { useState, useCallback, useEffect } from 'react';

export interface TextHighlightData {
  text: string;
  startOffset: number;
  endOffset: number;
  elementPath: string;
  /** Selection bounding rect as percentages relative to the container — used for popover anchoring. */
  rectPct: { x: number; y: number };
}

interface UseTextHighlightOptions {
  /** The container element to watch for text selections */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether text highlight mode is enabled */
  enabled: boolean;
}

/**
 * Builds a CSS-style path from the container root to the given node.
 * Used to relocate highlighted text on re-render.
 */
function buildElementPath(node: Node, container: HTMLElement): string {
  const parts: string[] = [];
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;

  while (current && current !== container && current instanceof HTMLElement) {
    const parent = current.parentNode;
    if (!parent) break;
    const children = Array.from(parent.children);
    const idx = children.indexOf(current);
    const tag = current.tagName.toLowerCase();
    parts.unshift(`${tag}:nth-child(${idx + 1})`);
    current = parent;
  }

  return parts.join(' > ');
}

/**
 * Computes a flat character offset for a text node within a container,
 * counting all text content in document order.
 */
function getTextOffset(container: HTMLElement, targetNode: Node, nodeOffset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node === targetNode) {
      return offset + nodeOffset;
    }
    offset += (node.textContent?.length || 0);
  }

  return offset;
}

/**
 * Captures a finalized text selection within `containerRef` on pointer
 * release. We deliberately do NOT react to `selectionchange` — that fires
 * mid-drag and would commit a partial selection (single word) before the
 * user finishes choosing the range. Listening for mouseup/touchend instead
 * lets the user drag freely across multiple lines.
 */
export function useTextHighlight({ containerRef, enabled }: UseTextHighlightOptions) {
  const [selection, setSelection] = useState<TextHighlightData | null>(null);

  const captureSelection = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return;

    const text = sel.toString().trim();
    if (!text) return;

    const startOffset = getTextOffset(container, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(container, range.endContainer, range.endOffset);
    const elementPath = buildElementPath(range.startContainer, container);

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const anchorXpx = (rect.left + rect.right) / 2 - containerRect.left;
    const anchorYpx = rect.top - containerRect.top;
    const rectPct = {
      x: containerRect.width > 0 ? (anchorXpx / containerRect.width) * 100 : 50,
      y: containerRect.height > 0 ? (anchorYpx / containerRect.height) * 100 : 50,
    };

    setSelection({ text, startOffset, endOffset, elementPath, rectPct });
  }, [containerRef]);

  useEffect(() => {
    if (!enabled) {
      setSelection(null);
      return;
    }

    // Wait one tick after pointer release so the browser has finalized the
    // Selection object before we read it.
    const onPointerUp = () => {
      setTimeout(captureSelection, 0);
    };

    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
    return () => {
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchend', onPointerUp);
    };
  }, [enabled, captureSelection]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  /**
   * Reset the captured-selection state without touching the browser's
   * native Selection. Use after handing off the data to a popover so a
   * subsequent drag can re-trigger capture, while the highlighted text
   * stays visible to the user.
   */
  const resetSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return { selection, clearSelection, resetSelection };
}
