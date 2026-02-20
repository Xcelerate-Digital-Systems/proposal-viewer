// components/admin/page-editor/usePricingState.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { ProposalPricing } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { PricingFormState, DEFAULT_PRICING, DEFAULT_INTRO } from './pageEditorTypes';

export function usePricingState(proposalId: string) {
  const confirm = useConfirm();
  const toast = useToast();

  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [pricingExists, setPricingExists] = useState(false);
  const [pricingPosition, setPricingPosition] = useState(-1);
  const [pricingForm, setPricingForm] = useState<PricingFormState>(DEFAULT_PRICING);
  const [pricingSaveStatus, setPricingSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const pricingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => { if (pricingDebounce.current) clearTimeout(pricingDebounce.current); };
  }, []);

  // Load pricing data
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/proposals/pricing?proposal_id=${proposalId}`);
        if (res.ok) {
          const data: ProposalPricing | null = await res.json();
          if (data) {
            setPricingExists(true);
            setPricingPosition(data.position);
            setPricingForm({
              enabled: data.enabled,
              title: data.title,
              introText: data.intro_text || DEFAULT_INTRO,
              items: data.items || [],
              optionalItems: data.optional_items || [],
              taxEnabled: data.tax_enabled,
              taxRate: data.tax_rate,
              taxLabel: data.tax_label,
              validityDays: data.validity_days,
              proposalDate: data.proposal_date || new Date().toISOString().split('T')[0],
            });
          }
        }
      } catch { /* no pricing yet */ }
      setPricingLoaded(true);
    };
    fetchPricing();
  }, [proposalId]);

  // Save pricing to API
  const savePricing = useCallback(async (form: PricingFormState, pos: number) => {
    setPricingSaveStatus('saving');
    try {
      await fetch('/api/proposals/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled: form.enabled,
          position: pos,
          title: form.title,
          intro_text: form.introText,
          items: form.items,
          optional_items: form.optionalItems,
          tax_enabled: form.taxEnabled,
          tax_rate: form.taxRate,
          tax_label: form.taxLabel,
          validity_days: form.validityDays,
          proposal_date: form.proposalDate,
        }),
      });
      setPricingSaveStatus('saved');
      setTimeout(() => setPricingSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setPricingSaveStatus('idle');
    }
  }, [proposalId, toast]);

  // Schedule debounced pricing save
  const schedulePricingSave = useCallback((form: PricingFormState, pos: number) => {
    if (pricingDebounce.current) clearTimeout(pricingDebounce.current);
    pricingDebounce.current = setTimeout(() => {
      savePricing(form, pos);
      pricingDebounce.current = null;
    }, 800);
  }, [savePricing]);

  // Update pricing form fields and schedule save
  const updatePricing = useCallback((changes: Partial<PricingFormState>) => {
    setPricingForm((prev) => {
      const next = { ...prev, ...changes };
      schedulePricingSave(next, pricingPosition);
      return next;
    });
  }, [schedulePricingSave, pricingPosition]);

  // Flush pending pricing save immediately
  const flushPricingSave = useCallback(async () => {
    if (pricingDebounce.current) {
      clearTimeout(pricingDebounce.current);
      pricingDebounce.current = null;
      await savePricing(pricingForm, pricingPosition);
    }
  }, [savePricing, pricingForm, pricingPosition]);

  // Add a new pricing page
  const addPricingPage = useCallback(async () => {
    setPricingExists(true);
    setPricingForm(DEFAULT_PRICING);
    setPricingPosition(-1);
    await savePricing(DEFAULT_PRICING, -1);
    toast.success('Pricing page added');
  }, [savePricing, toast]);

  // Remove (disable) pricing page
  const removePricingPage = useCallback(async () => {
    const ok = await confirm({
      title: 'Remove pricing page?',
      message: 'This will disable the pricing page. Your pricing data will be preserved and can be re-enabled later.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return false;

    const updated = { ...pricingForm, enabled: false };
    setPricingForm(updated);
    await savePricing(updated, pricingPosition);
    toast.success('Pricing page removed');
    return true;
  }, [confirm, pricingForm, pricingPosition, savePricing, toast]);

  return {
    pricingLoaded,
    pricingExists,
    pricingPosition,
    setPricingPosition,
    pricingForm,
    pricingSaveStatus,
    updatePricing,
    flushPricingSave,
    addPricingPage,
    removePricingPage,
    savePricing,
  };
}