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
  const [pricingIndent, setPricingIndent] = useState(0);
  const [pricingOrientation, setPricingOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [pricingLinkUrl, setPricingLinkUrl] = useState('');
  const [pricingLinkLabel, setPricingLinkLabel] = useState('');
  const [pricingForm, setPricingForm] = useState<PricingFormState>(DEFAULT_PRICING);
  const [pricingSaveStatus, setPricingSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const pricingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orientationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pricingDebounce.current) clearTimeout(pricingDebounce.current);
      if (linkDebounce.current) clearTimeout(linkDebounce.current);
      if (orientationDebounce.current) clearTimeout(orientationDebounce.current);
    };
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
            setPricingIndent(data.indent ?? 0);
            setPricingOrientation(
              ((data as Record<string, unknown>).orientation as 'auto' | 'portrait' | 'landscape') || 'auto'
            );
            setPricingLinkUrl((data as Record<string, unknown>).link_url as string || '');
            setPricingLinkLabel((data as Record<string, unknown>).link_label as string || '');
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
  const savePricing = useCallback(async (form: PricingFormState, pos: number, indent?: number) => {
    setPricingSaveStatus('saving');
    try {
      await fetch('/api/proposals/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled: form.enabled,
          position: pos,
          indent: indent ?? pricingIndent,
          orientation: pricingOrientation,
          title: form.title,
          intro_text: form.introText,
          items: form.items,
          optional_items: form.optionalItems,
          tax_enabled: form.taxEnabled,
          tax_rate: form.taxRate,
          tax_label: form.taxLabel,
          validity_days: form.validityDays,
          proposal_date: form.proposalDate,
          link_url: pricingLinkUrl || null,
          link_label: pricingLinkLabel || null,
        }),
      });
      setPricingSaveStatus('saved');
      setTimeout(() => setPricingSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setPricingSaveStatus('idle');
    }
  }, [proposalId, pricingIndent, pricingOrientation, pricingLinkUrl, pricingLinkLabel, toast]);

  // Save only orientation (lightweight, debounced)
  const savePricingOrientation = useCallback(async (orientation: 'auto' | 'portrait' | 'landscape') => {
    try {
      await fetch('/api/proposals/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          orientation,
        }),
      });
    } catch {
      toast.error('Failed to save orientation');
    }
  }, [proposalId, toast]);

  // Update orientation with debounce
  const updatePricingOrientation = useCallback((orientation: 'auto' | 'portrait' | 'landscape') => {
    setPricingOrientation(orientation);
    if (orientationDebounce.current) clearTimeout(orientationDebounce.current);
    orientationDebounce.current = setTimeout(() => {
      savePricingOrientation(orientation);
      orientationDebounce.current = null;
    }, 400);
  }, [savePricingOrientation]);

  // Save only link fields (debounced, lightweight)
  const savePricingLink = useCallback(async (url: string, label: string) => {
    try {
      await fetch('/api/proposals/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          link_url: url || null,
          link_label: label || null,
        }),
      });
    } catch {
      toast.error('Failed to save link');
    }
  }, [proposalId, toast]);

  // Update link with debounce
  const updatePricingLink = useCallback((url: string, label: string) => {
    setPricingLinkUrl(url);
    setPricingLinkLabel(label);
    if (linkDebounce.current) clearTimeout(linkDebounce.current);
    linkDebounce.current = setTimeout(() => {
      savePricingLink(url, label);
      linkDebounce.current = null;
    }, 800);
  }, [savePricingLink]);

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
    if (linkDebounce.current) {
      clearTimeout(linkDebounce.current);
      linkDebounce.current = null;
      await savePricingLink(pricingLinkUrl, pricingLinkLabel);
    }
    if (orientationDebounce.current) {
      clearTimeout(orientationDebounce.current);
      orientationDebounce.current = null;
      await savePricingOrientation(pricingOrientation);
    }
  }, [savePricing, pricingForm, pricingPosition, savePricingLink, pricingLinkUrl, pricingLinkLabel, savePricingOrientation, pricingOrientation]);

  // Add a new pricing page
  const addPricingPage = useCallback(async () => {
    setPricingExists(true);
    setPricingForm(DEFAULT_PRICING);
    setPricingPosition(-1);
    setPricingOrientation('auto');
    setPricingLinkUrl('');
    setPricingLinkLabel('');
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
    pricingIndent,
    setPricingIndent,
    pricingOrientation,
    setPricingOrientation,
    updatePricingOrientation,
    pricingLinkUrl,
    pricingLinkLabel,
    updatePricingLink,
    pricingForm,
    pricingSaveStatus,
    updatePricing,
    flushPricingSave,
    addPricingPage,
    removePricingPage,
    savePricing,
  };
}