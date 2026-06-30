'use client';

import { useState, useEffect, useMemo } from 'react';
import type { FeedbackItem } from '@/lib/supabase';
import { applyVersion, type VersionView } from '@/lib/feedback/versions';
import {
  type FeedbackItemView,
  defaultViewForItem,
} from '@/lib/types/feedback';

/* ─── Hook params ──────────────────────────────────────────────── */

interface UseFeedbackDetailSelectionParams {
  items: FeedbackItem[];
  initialItemId?: string | null;
  initialTypeFilter?: string | null;
  singleItemOnly: boolean;
  versions?: VersionView[];
  activeVersionId?: string | null;
}

/* ─── Hook return ──────────────────────────────────────────────── */

export interface FeedbackDetailSelectionState {
  selectedItemId: string | null;
  setSelectedItemId: React.Dispatch<React.SetStateAction<string | null>>;
  typeFilter: string | null;
  setTypeFilter: React.Dispatch<React.SetStateAction<string | null>>;
  filteredItems: FeedbackItem[];
  rawSelectedItem: FeedbackItem | null;
  activeVersion: VersionView | null;
  selectedItem: FeedbackItem | null;
  activeView: FeedbackItemView;
  setActiveView: React.Dispatch<React.SetStateAction<FeedbackItemView>>;
  currentMockupView: FeedbackItemView;
  currentIdx: number;
  availableTypes: string[];
}

/* ─── Hook ─────────────────────────────────────────────────────── */

export function useFeedbackDetailSelection({
  items,
  initialItemId,
  initialTypeFilter,
  singleItemOnly,
  versions,
  activeVersionId = null,
}: UseFeedbackDetailSelectionParams): FeedbackDetailSelectionState {
  // ── Selection state ──
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialItemId || items[0]?.id || null,
  );
  const [typeFilter, setTypeFilter] = useState<string | null>(initialTypeFilter || null);

  // ── Active mockup sub-view (lead-form page, email client, ad platform, etc.)
  // Lifted out of ItemContentView so we can: (a) scope new pins / drawings
  // / highlights to the current view, and (b) jump to a pin's stored view
  // when the reviewer clicks it from the comments list. Null = use the
  // item's natural default. Reset on item change. ──
  const [activeView, setActiveView] = useState<FeedbackItemView>(null);

  // ── Derived data ──
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((i) => i.type)));
    return types.sort();
  }, [items]);

  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter],
  );

  const rawSelectedItem = useMemo(() => {
    return (
      filteredItems.find((i) => i.id === selectedItemId) ||
      items.find((i) => i.id === selectedItemId) ||
      null
    );
  }, [filteredItems, items, selectedItemId]);

  // Merge the active version's asset fields onto the item so every downstream
  // renderer (ItemContentView, thumb strip, etc.) sees the right URLs / copy
  // without knowing about versions. Falls through to raw item when the item
  // has no versions, keeping pre-versioning items unchanged.
  const activeVersion = useMemo<VersionView | null>(() => {
    if (!versions || versions.length === 0) return null;
    return versions.find((v) => (v.id ?? null) === (activeVersionId ?? null)) || versions[0];
  }, [versions, activeVersionId]);

  const selectedItem = useMemo<FeedbackItem | null>(() => {
    if (!rawSelectedItem) return null;
    if (!activeVersion) return rawSelectedItem;
    return applyVersion(rawSelectedItem, activeVersion);
  }, [rawSelectedItem, activeVersion]);

  // Resolve the active sub-view: explicit override, else item's natural default.
  // Null for items without sub-views (image, video, pdf, webpage).
  const currentMockupView = useMemo<FeedbackItemView>(
    () => (activeView !== null ? activeView : selectedItem ? defaultViewForItem(selectedItem) : null),
    [activeView, selectedItem],
  );

  const currentIdx = filteredItems.findIndex((i) => i.id === selectedItemId);

  // ── Keep selection in sync when filter changes and current item is hidden ──
  useEffect(() => {
    if (singleItemOnly) return;
    if (filteredItems.length > 0 && !filteredItems.find((i) => i.id === selectedItemId)) {
      const fallback = filteredItems[0].id;
      setSelectedItemId(fallback);
    }
  }, [filteredItems, selectedItemId, singleItemOnly]);

  // ── Sync initial item when it changes (e.g. admin router navigation) ──
  useEffect(() => {
    if (initialItemId && initialItemId !== selectedItemId) {
      setSelectedItemId(initialItemId);
    }
  }, [initialItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync initial type filter ──
  useEffect(() => {
    if (initialTypeFilter !== undefined) {
      setTypeFilter(initialTypeFilter || null);
    }
  }, [initialTypeFilter]);

  // Close popover and reset active sub-view when item changes
  useEffect(() => {
    setActiveView(null);
  }, [selectedItemId]);

  return {
    selectedItemId,
    setSelectedItemId,
    typeFilter,
    setTypeFilter,
    filteredItems,
    rawSelectedItem,
    activeVersion,
    selectedItem,
    activeView,
    setActiveView,
    currentMockupView,
    currentIdx,
    availableTypes,
  };
}
