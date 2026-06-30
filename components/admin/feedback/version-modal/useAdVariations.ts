'use client';

import { useState, useEffect, useRef } from 'react';
import type { FeedbackItem } from '@/lib/supabase';
import type { AdCopyVariation } from '@/lib/types/feedback';
import { authFetch } from '@/lib/auth-fetch';
import { type PickerVariation, type AssetKind, newTempVariation } from './types';

export function useAdVariations(item: FeedbackItem, kind: AssetKind) {
  const [variations, setVariations] = useState<PickerVariation[]>([]);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const originalExistingRef = useRef<Map<string, { label: string; headline: string; primary_text: string }>>(new Map());

  // Fetch campaign variations + current item links via the API
  useEffect(() => {
    if (kind !== 'ad') return;
    let cancelled = false;
    setLoadingVariations(true);
    (async () => {
      const res = await authFetch(`/api/campaigns/${item.review_project_id}/ad-variations?company_id=${item.company_id}`);
      if (cancelled || !res.ok) { setLoadingVariations(false); return; }
      const { variations: existingVariations, links } = await res.json() as {
        variations: AdCopyVariation[];
        links: { review_item_id: string; ad_copy_variation_id: string }[];
      };

      const usageCounts: Record<string, number> = {};
      for (const l of links) {
        usageCounts[l.ad_copy_variation_id] = (usageCounts[l.ad_copy_variation_id] ?? 0) + 1;
      }

      const linkedIds = new Set(
        links.filter((l) => l.review_item_id === item.id).map((l) => l.ad_copy_variation_id)
      );

      const picker: PickerVariation[] = existingVariations
        .filter((v) => v.headline.trim() || v.primary_text.trim())
        .map((v) => ({
          id: v.id,
          label: v.label || '',
          headline: v.headline,
          primary_text: v.primary_text,
          isExisting: true,
          selected: linkedIds.has(v.id),
          usedByCount: usageCounts[v.id] || 0,
        }));

      // Snapshot for edit detection
      const snap = new Map<string, { label: string; headline: string; primary_text: string }>();
      for (const v of picker) snap.set(v.id, { label: v.label, headline: v.headline, primary_text: v.primary_text });
      originalExistingRef.current = snap;

      if (!cancelled) {
        setVariations(picker.length > 0 ? picker : [newTempVariation()]);
        const firstSelected = picker.find((v) => v.selected);
        if (firstSelected) setActiveVariationId(firstSelected.id);
        else if (picker.length > 0) setActiveVariationId(picker[0].id);
        setLoadingVariations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item.id, item.review_project_id, kind]);

  const selectedVariations = variations.filter((v) => v.selected);
  const activeVariation = selectedVariations.find((v) => v.id === activeVariationId)
    ?? selectedVariations[0] ?? null;

  const toggleVariation = (id: string) => {
    setVariations((prev) => prev.map((v) => v.id === id ? { ...v, selected: !v.selected } : v));
  };

  const patchVariation = (id: string, patch: Partial<PickerVariation>) =>
    setVariations((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addNewVariation = () => {
    const v = newTempVariation();
    setVariations((prev) => [...prev, v]);
    setActiveVariationId(v.id);
  };

  const removeVariation = (id: string) => {
    setVariations((prev) => {
      const v = prev.find((x) => x.id === id);
      if (!v) return prev;
      if (!v.isExisting) {
        const next = prev.filter((x) => x.id !== id);
        if (activeVariationId === id) {
          const firstSelected = next.find((x) => x.selected);
          if (firstSelected) setActiveVariationId(firstSelected.id);
        }
        return next;
      }
      return prev.map((x) => x.id === id ? { ...x, selected: false } : x);
    });
  };

  return {
    variations,
    setVariations,
    activeVariationId,
    setActiveVariationId,
    loadingVariations,
    selectedVariations,
    activeVariation,
    toggleVariation,
    patchVariation,
    addNewVariation,
    removeVariation,
    originalExistingRef,
  };
}
