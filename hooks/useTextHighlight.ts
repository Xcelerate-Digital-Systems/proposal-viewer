// hooks/useTextHighlight.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface TextHighlightData {
  text: string;
  startOffset: number;
  endOffset: number;
  elementPath: string;
}

interface UseTextHighlightOptions {
  /** The container element to watch for text selections */
  containerRef: React.RefObject<HTMLElement>;
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

export function useTextHighlight({ containerRef, enabled }: UseTextHighlightOptions) {
  const [selection, setSelection] = useState<TextHighlightData | null>(null);
  const [buttonPos, setButtonPos] = useState<{ x: number; y: number } | null>(null);
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelectionChange = useCallback(() => {
    if (!enabled || !containerRef.current) {
      setSelection(null);
      setButtonPos(null);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      // Delay clearing so clicking the "Add Comment" button doesn't race
      selectionTimeoutRef.current = setTimeout(() => {
        setSelection(null);
        setButtonPos(null);
      }, 200);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = containerRef.current;

    // Ensure selection is within our container
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      setSelection(null);
      setButtonPos(null);
      return;
    }

    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
      selectionTimeoutRef.current = null;
    }

    const text = sel.toString().trim();
    if (!text) {
      setSelection(null);
      setButtonPos(null);
      return;
    }

    const startOffset = getTextOffset(container, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(container, range.endContainer, range.endOffset);
    const elementPath = buildElementPath(range.startContainer, container);

    setSelection({
      text,
      startOffset,
      endOffset,
      elementPath,
    });

    // Position the floating button near the end of the selection
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setButtonPos({
      x: rect.right - containerRect.left,
      y: rect.top - containerRect.top - 36,
    });
  }, [enabled, containerRef]);

  useEffect(() => {
    if (!enabled) {
      setSelection(null);
      setButtonPos(null);
      return;
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current);
    };
  }, [enabled, handleSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setButtonPos(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, buttonPos, clearSelection };
}
