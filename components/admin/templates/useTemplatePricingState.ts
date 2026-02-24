// components/admin/templates/useTemplatePricingState.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  TemplatePricing, PricingLineItem, PricingOptionalItem,
  PaymentSchedule, DEFAULT_PAYMENT_SCHEDULE,
} from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

export type TemplatePricingFormState = {
  enabled: boolean;
  title: string;
  introText: string;
  items: PricingLineItem[];
  optionalItems: PricingOptionalItem[];
  paymentSchedule: PaymentSchedule;
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  validityDays: number | null;
};

const DEFAULT_PRICING: TemplatePricingFormState = {
  enabled: true,
  title: 'Project Investment',
  introText: DEFAULT_INTRO,
  items: [],
  optionalItems: [],
  paymentSchedule: DEFAULT_PAYMENT_SCHEDULE,
  taxEnabled: true,
  taxRate: 10,
  taxLabel: 'GST (10%)',
  validityDays: 30,
};

export function useTemplatePricingState(templateId: string, pageCount: number) {
  const confirm = useConfirm();
  const toast = useToast();

  const [pricingLoaded, setPricingLoaded] = useState(false);
  const [pricingExists, setPricingExists] = useState(false);
  const [pricingPosition, setPricingPosition] = useState(-1);
  const [pricingIndent, setPricingIndent] = useState(0);
  const [pricingForm, setPricingForm] = useState<TemplatePricingFormState>(DEFAULT_PRICING);
  const [pricingSaveStatus, setPricingSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pricingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pricingDebounce.current) clearTimeout(pricingDebounce.current);
    };
  }, []);

  // Fetch pricing
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/templates/pricing?template_id=${templateId}`);
        if (res.ok) {
          const data: TemplatePricing | null = await res.json();
          if (data) {
            setPricingExists(true);
            setPricingPosition(data.position);
            setPricingIndent(data.indent ?? 0);
            setPricingForm({
              enabled: data.enabled,
              title: data.title,
              introText: data.intro_text || DEFAULT_INTRO,
              items: data.items || [],
              optionalItems: data.optional_items || [],
              paymentSchedule: data.payment_schedule || DEFAULT_PAYMENT_SCHEDULE,
              taxEnabled: data.tax_enabled,
              taxRate: data.tax_rate,
              taxLabel: data.tax_label,
              validityDays: data.validity_days,
            });
          }
        }
      } catch { /* no pricing yet */ }
      setPricingLoaded(true);
    };
    fetchPricing();
  }, [templateId]);

  // Save pricing
  const savePricing = useCallback(async (form: TemplatePricingFormState, pos: number, indent?: number) => {
    setPricingSaveStatus('saving');
    try {
      await fetch('/api/templates/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          enabled: form.enabled,
          position: pos,
          indent: indent ?? pricingIndent,
          title: form.title,
          intro_text: form.introText,
          items: form.items,
          optional_items: form.optionalItems,
          payment_schedule: form.paymentSchedule,
          tax_enabled: form.taxEnabled,
          tax_rate: form.taxRate,
          tax_label: form.taxLabel,
          validity_days: form.validityDays,
        }),
      });
      setPricingSaveStatus('saved');
      setTimeout(() => setPricingSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setPricingSaveStatus('idle');
    }
  }, [templateId, pricingIndent, toast]);

  // Add pricing page
  const addPricingPage = useCallback(async () => {
    const pos = pageCount;
    const form = { ...DEFAULT_PRICING, enabled: true };
    setPricingForm(form);
    setPricingExists(true);
    setPricingPosition(pos);
    await savePricing(form, pos);
    toast.success('Pricing page added');
  }, [pageCount, savePricing, toast]);

  // Remove pricing page
  const removePricingPage = useCallback(async () => {
    const ok = await confirm({
      title: 'Remove Pricing Page',
      message: 'Remove the pricing page from this template?',
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
    pricingLoaded, pricingExists, pricingPosition, setPricingPosition,
    pricingIndent, setPricingIndent,
    pricingForm, setPricingForm, pricingSaveStatus,
    savePricing, addPricingPage, removePricingPage,
  };
}