'use client';

import { useEffect, useCallback, useMemo } from 'react';
import type { FeedbackItem, FeedbackComment } from '@/lib/supabase';

/* ─── Hook params ──────────────────────────────────────────────── */

interface UseFeedbackDetailNavigationParams {
  items: FeedbackItem[];
  filteredItems: FeedbackItem[];
  comments: FeedbackComment[];
  selectedItemId: string | null;
  setSelectedItemId: React.Dispatch<React.SetStateAction<string | null>>;
  typeFilter: string | null;
  setTypeFilter: React.Dispatch<React.SetStateAction<string | null>>;
  currentIdx: number;
  resetFeedback: () => void;
  onItemChange?: (itemId: string, typeFilter: string | null) => void;
  onFilterChange?: (type: string | null, firstItemId: string | null) => void;
}

/* ─── Hook return ──────────────────────────────────────────────── */

export interface FeedbackDetailNavigationState {
  goToItem: (idx: number) => void;
  handleSidebarSelect: (id: string) => void;
  handleFilterChange: (type: string | null) => void;
  reviewedCount: number;
}

/* ─── Hook ─────────────────────────────────────────────────────── */

export function useFeedbackDetailNavigation({
  items,
  filteredItems,
  comments,
  selectedItemId,
  setSelectedItemId,
  typeFilter,
  setTypeFilter,
  currentIdx,
  resetFeedback,
  onItemChange,
  onFilterChange,
}: UseFeedbackDetailNavigationParams): FeedbackDetailNavigationState {
  // ── Navigate items ──
  const goToItem = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < filteredItems.length) {
        const nextId = filteredItems[idx].id;
        setSelectedItemId(nextId);
        resetFeedback();
        onItemChange?.(nextId, typeFilter);
      }
    },
    [filteredItems, typeFilter, resetFeedback, onItemChange, setSelectedItemId],
  );

  // ── Select item from sidebar ──
  const handleSidebarSelect = useCallback(
    (id: string) => {
      setSelectedItemId(id);
      resetFeedback();
      onItemChange?.(id, typeFilter);
    },
    [typeFilter, resetFeedback, onItemChange, setSelectedItemId],
  );

  // ── Filter change ──
  const handleFilterChange = useCallback(
    (type: string | null) => {
      setTypeFilter(type);
      const newFiltered = type ? items.filter((i) => i.type === type) : items;
      const currentStillVisible = newFiltered.some((i) => i.id === selectedItemId);
      const targetId = currentStillVisible ? selectedItemId : newFiltered[0]?.id || null;

      if (targetId && targetId !== selectedItemId) {
        setSelectedItemId(targetId);
      }

      onFilterChange?.(type, targetId);
      onItemChange?.(targetId!, type);
    },
    [items, selectedItemId, onFilterChange, onItemChange, setSelectedItemId, setTypeFilter],
  );

  // ── Keyboard shortcuts (← → for item nav) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'ArrowLeft' && currentIdx > 0) {
        e.preventDefault();
        goToItem(currentIdx - 1);
      } else if (e.key === 'ArrowRight' && currentIdx < filteredItems.length - 1) {
        e.preventDefault();
        goToItem(currentIdx + 1);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [currentIdx, filteredItems.length, goToItem]);

  // ── Progress: items with at least one comment or non-default status ──
  const reviewedCount = useMemo(() => {
    const itemsWithComments = new Set(comments.map((c) => c.review_item_id));
    return filteredItems.filter(
      (i) =>
        itemsWithComments.has(i.id) ||
        (i.status !== 'client_review' && i.status !== 'draft' && i.status !== 'internal_review' && i.status !== 'in_progress'),
    ).length;
  }, [filteredItems, comments]);

  return {
    goToItem,
    handleSidebarSelect,
    handleFilterChange,
    reviewedCount,
  };
}
