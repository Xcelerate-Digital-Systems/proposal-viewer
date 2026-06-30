'use client';

import { useState, useRef, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type { AdCopyVariation } from '@/lib/types/feedback';
import { type PickerVariation, newInlineVariation } from './ad-form-types';

export function useAdFormVariations(reviewProjectId?: string, companyId?: string) {
  const [variations, setVariations] = useState<PickerVariation[]>(() => [newInlineVariation()]);
  const [activeVariationId, setActiveVariationId] = useState<string>(() => variations[0].id);
  const [loadingExisting, setLoadingExisting] = useState(false);
  // Snapshot of existing variations at load time — used to detect edits on submit
  const originalExistingRef = useRef<Map<string, { label: string; headline: string; primary_text: string }>>(new Map());

  // Fetch existing campaign variations via the API (handles super-admin auth)
  useEffect(() => {
    if (!reviewProjectId) return;
    let cancelled = false;
    setLoadingExisting(true);
    (async () => {
      const qs = companyId ? `?company_id=${companyId}` : '';
      const res = await authFetch(`/api/campaigns/${reviewProjectId}/ad-variations${qs}`);
      if (cancelled || !res.ok) { setLoadingExisting(false); return; }
      const { variations: existingVariations, links } = await res.json() as {
        variations: AdCopyVariation[];
        links: { review_item_id: string; ad_copy_variation_id: string }[];
      };

      const usageCounts: Record<string, number> = {};
      for (const l of links) {
        usageCounts[l.ad_copy_variation_id] = (usageCounts[l.ad_copy_variation_id] ?? 0) + 1;
      }

      if (!cancelled && existingVariations.length > 0) {
        const existingPicker: PickerVariation[] = existingVariations
          .filter((v) => v.headline.trim() || v.primary_text.trim())
          .map((v) => ({
            id: v.id,
            label: v.label || '',
            headline: v.headline,
            primary_text: v.primary_text,
            isExisting: true,
            selected: false,
            usedByCount: usageCounts[v.id] || 0,
          }));

        // Snapshot for edit detection
        const snap = new Map<string, { label: string; headline: string; primary_text: string }>();
        for (const v of existingPicker) snap.set(v.id, { label: v.label, headline: v.headline, primary_text: v.primary_text });
        originalExistingRef.current = snap;

        setVariations((prev) => {
          const hasOnlyEmptyNew = prev.length === 1
            && !prev[0].isExisting
            && !prev[0].headline.trim()
            && !prev[0].primary_text.trim();
          if (hasOnlyEmptyNew && existingPicker.length > 0) {
            return [...existingPicker, ...prev];
          }
          return [...existingPicker, ...prev];
        });
      }
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [reviewProjectId]);

  const selectedVariations = variations.filter((v) => v.selected);
  const activeVariation = selectedVariations.find((v) => v.id === activeVariationId)
    ?? selectedVariations[0]
    ?? null;

  const toggleVariation = (id: string) => {
    setVariations((prev) => prev.map((v) =>
      v.id === id ? { ...v, selected: !v.selected } : v
    ));
  };

  const patchVariation = (id: string, patch: Partial<PickerVariation>) =>
    setVariations((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addNewVariation = () => {
    const v = newInlineVariation();
    setVariations((prev) => [...prev, v]);
    setActiveVariationId(v.id);
  };

  const removeVariation = (id: string) => {
    setVariations((prev) => {
      const v = prev.find((x) => x.id === id);
      if (!v) return prev;
      if (!v.isExisting) {
        const next = prev.filter((x) => x.id !== id);
        if (activeVariationId === id && next.length > 0) {
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
    loadingExisting,
    selectedVariations,
    activeVariation,
    originalExistingRef,
    toggleVariation,
    patchVariation,
    addNewVariation,
    removeVariation,
  };
}
