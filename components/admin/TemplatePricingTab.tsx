// components/admin/TemplatePricingTab.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, DollarSign, Loader2 } from 'lucide-react';
import { TemplatePricing, PricingLineItem, PricingOptionalItem } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import PricingSettings from './pricing/PricingSettings';
import PricingLineItems from './pricing/PricingLineItems';
import PricingOptionalItems from './pricing/PricingOptionalItems';
import PricingTotals from './pricing/PricingTotals';

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

type PricingFormState = {
  enabled: boolean;
  title: string;
  introText: string;
  items: PricingLineItem[];
  optionalItems: PricingOptionalItem[];
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  validityDays: number | null;
};

const DEFAULT_PRICING: PricingFormState = {
  enabled: true,
  title: 'Project Investment',
  introText: DEFAULT_INTRO,
  items: [],
  optionalItems: [],
  taxEnabled: true,
  taxRate: 10,
  taxLabel: 'GST (10%)',
  validityDays: 30,
};

interface TemplatePricingTabProps {
  templateId: string;
}

export default function TemplatePricingTab({ templateId }: TemplatePricingTabProps) {
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [position, setPosition] = useState(-1);
  const [form, setForm] = useState<PricingFormState>(DEFAULT_PRICING);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Load pricing data
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/templates/pricing?template_id=${templateId}`);
        if (res.ok) {
          const data: TemplatePricing | null = await res.json();
          if (data) {
            setExists(true);
            setPosition(data.position);
            setForm({
              enabled: data.enabled,
              title: data.title,
              introText: data.intro_text || DEFAULT_INTRO,
              items: data.items || [],
              optionalItems: data.optional_items || [],
              taxEnabled: data.tax_enabled,
              taxRate: data.tax_rate,
              taxLabel: data.tax_label,
              validityDays: data.validity_days,
            });
          }
        }
      } catch { /* no pricing yet */ }
      setLoaded(true);
    };
    fetchPricing();
  }, [templateId]);

  // Save pricing
  const savePricing = useCallback(async (formData: PricingFormState, pos: number) => {
    setSaveStatus('saving');
    try {
      await fetch('/api/templates/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          enabled: formData.enabled,
          position: pos,
          title: formData.title,
          intro_text: formData.introText,
          items: formData.items,
          optional_items: formData.optionalItems,
          tax_enabled: formData.taxEnabled,
          tax_rate: formData.taxRate,
          tax_label: formData.taxLabel,
          validity_days: formData.validityDays,
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setSaveStatus('idle');
    }
  }, [templateId, toast]);

  // Debounced update
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

  // Toggle enabled — immediate save
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
      {/* Toggle banner */}
      <button
        type="button"
        onClick={toggleEnabled}
        className={`w-full flex items-center justify-between rounded-xl px-5 py-4 mb-6 border transition-all ${
          form.enabled
            ? 'bg-[#017C87]/5 border-[#017C87]/30'
            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${
            form.enabled ? 'bg-[#017C87]/10' : 'bg-gray-100'
          }`}>
            <DollarSign size={20} className={form.enabled ? 'text-[#017C87]' : 'text-gray-400'} />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-gray-900">Include Pricing Page</h4>
            <p className="text-xs text-gray-400">
              {form.enabled
                ? 'Proposals created from this template will include a pricing page'
                : 'Enable to add default pricing to this template'}
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
          {/* Custom toggle switch */}
          <div className={`relative w-12 h-7 rounded-full transition-colors ${
            form.enabled ? 'bg-[#017C87]' : 'bg-gray-300'
          }`}>
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              form.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`} />
          </div>
        </div>
      </button>

      {/* Pricing editor — shown when enabled */}
      {form.enabled ? (
        <div className="space-y-6 max-w-3xl">
          <PricingSettings
            title={form.title}
            introText={form.introText}
            taxEnabled={form.taxEnabled}
            validityDays={form.validityDays}
            proposalDate={new Date().toISOString().split('T')[0]}
            onTitleChange={(v) => updateForm({ title: v })}
            onIntroTextChange={(v) => updateForm({ introText: v })}
            onTaxEnabledChange={(v) => updateForm({ taxEnabled: v })}
            onValidityDaysChange={(v) => updateForm({ validityDays: v })}
            onProposalDateChange={() => {/* no-op for templates */}}
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
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <DollarSign size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400 mb-1">Pricing is currently disabled</p>
          <p className="text-xs text-gray-300">Click the toggle above to add default pricing to this template</p>
        </div>
      )}
    </div>
  );
}