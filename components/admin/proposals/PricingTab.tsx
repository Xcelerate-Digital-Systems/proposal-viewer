// components/admin/proposals/PricingTab.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, DollarSign, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
ProposalPricing, PricingLineItem, PricingOptionalItem,
PaymentSchedule, DEFAULT_PAYMENT_SCHEDULE, normalizePaymentSchedule,
} from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import PricingSettings from '../pricing/PricingSettings';
import PricingLineItems from '../pricing/PricingLineItems';
import PricingOptionalItems from '../pricing/PricingOptionalItems';
import PricingTotals from '../pricing/PricingTotals';
import PricingPaymentSchedule from '../pricing/PricingPaymentSchedule';

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

type PricingFormState = {
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
  proposalDate: string;
};

const DEFAULT_PRICING: PricingFormState = {
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
  proposalDate: new Date().toISOString().split('T')[0],
};

interface PricingTabProps {
  proposalId: string;
}

export default function PricingTab({ proposalId }: PricingTabProps) {
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [position, setPosition] = useState(-1);
  const [form, setForm] = useState<PricingFormState>(DEFAULT_PRICING);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/proposals/pricing?proposal_id=${proposalId}`);
        if (res.ok) {
          const data: ProposalPricing | null = await res.json();
          if (data) {
            setExists(true);
            setPosition(data.position);
            setForm({
              enabled: data.enabled,
              title: data.title,
              introText: data.intro_text || DEFAULT_INTRO,
              items: data.items || [],
              optionalItems: data.optional_items || [],
              paymentSchedule: normalizePaymentSchedule(data.payment_schedule),
              taxEnabled: data.tax_enabled,
              taxRate: data.tax_rate,
              taxLabel: data.tax_label,
              validityDays: data.validity_days,
              proposalDate: data.proposal_date || new Date().toISOString().split('T')[0],
            });
          }
        }
      } catch { /* no pricing yet */ }
      setLoaded(true);
    };
    fetchPricing();
  }, [proposalId]);

  const savePricing = useCallback(async (formData: PricingFormState, pos: number) => {
    setSaveStatus('saving');
    try {
      await fetch('/api/proposals/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled: formData.enabled,
          position: pos,
          title: formData.title,
          intro_text: formData.introText,
          items: formData.items,
          optional_items: formData.optionalItems,
          payment_schedule: formData.paymentSchedule,
          tax_enabled: formData.taxEnabled,
          tax_rate: formData.taxRate,
          tax_label: formData.taxLabel,
          validity_days: formData.validityDays,
          proposal_date: formData.proposalDate,
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setSaveStatus('idle');
    }
  }, [proposalId, toast]);

  const updateForm = useCallback((changes: Partial<PricingFormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...changes };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        savePricing(next, position);
        debounceRef.current = null;
      }, 800);
      return next;
    });
  }, [savePricing, position]);

  const toggleEnabled = useCallback(async () => {
    const newEnabled = !form.enabled;
    const updated = { ...form, enabled: newEnabled };
    setForm(updated);

    if (!exists) {
      setExists(true);
      await savePricing(updated, -1);
      toast.success('Pricing page enabled');
    } else {
      await savePricing(updated, position);
      toast.success(newEnabled ? 'Pricing page enabled' : 'Pricing page disabled');
    }
  }, [form, exists, position, savePricing, toast]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Toggle header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#017C87]/10">
            <DollarSign size={18} className="text-[#017C87]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Pricing Page</h4>
            <p className="text-xs text-gray-400">
              {form.enabled ? 'Included in proposal' : 'Not included in proposal'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin text-gray-300" />}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            onClick={toggleEnabled}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
          >
            {form.enabled ? (
              <>
                <ToggleRight size={28} className="text-[#017C87]" />
                <span className="text-[#017C87]">Enabled</span>
              </>
            ) : (
              <>
                <ToggleLeft size={28} className="text-gray-300" />
                <span className="text-gray-400">Disabled</span>
              </>
            )}
          </button>
        </div>
      </div>

      {form.enabled ? (
        <div className="space-y-6 max-w-3xl">
          <PricingSettings
            title={form.title}
            introText={form.introText}
            taxEnabled={form.taxEnabled}
            validityDays={form.validityDays}
            proposalDate={form.proposalDate}
            onTitleChange={(v) => updateForm({ title: v })}
            onIntroTextChange={(v) => updateForm({ introText: v })}
            onTaxEnabledChange={(v) => updateForm({ taxEnabled: v })}
            onValidityDaysChange={(v) => updateForm({ validityDays: v })}
            onProposalDateChange={(v) => updateForm({ proposalDate: v })}
          />
          <PricingLineItems
            items={form.items}
            onChange={(items) => updateForm({ items })}
          />
          <PricingOptionalItems
            items={form.optionalItems}
            onChange={(optionalItems) => updateForm({ optionalItems })}
          />
          <PricingTotals
            items={form.items}
            taxEnabled={form.taxEnabled}
            taxRate={form.taxRate}
            taxLabel={form.taxLabel}
          />
          <PricingPaymentSchedule
            schedule={form.paymentSchedule}
            items={form.items}
            taxEnabled={form.taxEnabled}
            taxRate={form.taxRate}
            onChange={(paymentSchedule) => updateForm({ paymentSchedule })}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <DollarSign size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400 mb-1">Pricing is currently disabled</p>
          <p className="text-xs text-gray-300">Toggle the switch above to add a pricing page to this proposal</p>
        </div>
      )}
    </div>
  );
}