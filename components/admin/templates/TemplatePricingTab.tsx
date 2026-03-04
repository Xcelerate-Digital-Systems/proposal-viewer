// components/admin/templates/TemplatePricingTab.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, DollarSign, Loader2, Eye } from 'lucide-react';
import { TemplatePricing, PricingLineItem, PricingOptionalItem, PaymentSchedule, DEFAULT_PAYMENT_SCHEDULE, ProposalPricing, } from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { useToast } from '@/components/ui/Toast';
import Toggle from '@/components/ui/Toggle';
import PricingPreview from '@/components/admin/shared/PricingPreview';
import PricingSettings from '../pricing/PricingSettings';
import PricingLineItems from '../pricing/PricingLineItems';
import PricingOptionalItems from '../pricing/PricingOptionalItems';
import PricingTotals from '../pricing/PricingTotals';
import PricingPaymentSchedule from '../pricing/PricingPaymentSchedule';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';



/* ------------------------------------------------------------------ */
/*  Form State                                                         */
/* ------------------------------------------------------------------ */

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
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TemplatePricingTabProps {
  templateId: string;
  companyId: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TemplatePricingTab({ templateId, companyId }: TemplatePricingTabProps) {
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [position, setPosition] = useState(-1);
  const [form, setForm] = useState<PricingFormState>(DEFAULT_PRICING);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [showPreview, setShowPreview] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  /* ── Fetch pricing ──────────────────────────────────────────── */

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
              paymentSchedule: data.payment_schedule || DEFAULT_PAYMENT_SCHEDULE,
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

  /* ── Fetch branding ─────────────────────────────────────────── */

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch(`/api/company/branding?company_id=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          setBranding({ ...DEFAULT_BRANDING, ...data });
        }
      } catch { /* Use defaults */ }
    };
    fetchBranding();
  }, [companyId]);

  /* ── Save ───────────────────────────────────────────────────── */

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
          payment_schedule: formData.paymentSchedule,
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

  /* ── Toggle ─────────────────────────────────────────────────── */

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

  /* ── Build preview data ─────────────────────────────────────── */

  const previewPricing: ProposalPricing = {
    id: 'preview',
    proposal_id: templateId,
    company_id: companyId,
    enabled: form.enabled,
    position,
    indent: 0,
    title: form.title,
    intro_text: form.introText,
    items: form.items,
    optional_items: form.optionalItems,
    payment_schedule: form.paymentSchedule,
    tax_enabled: form.taxEnabled,
    tax_rate: form.taxRate,
    tax_label: form.taxLabel,
    validity_days: form.validityDays,
    proposal_date: new Date().toISOString().split('T')[0],
    created_at: '',
    updated_at: '',
  };

  /* ── Loading ────────────────────────────────────────────────── */

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

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Toggle header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#017C87]/10">
            <DollarSign size={18} className="text-[#017C87]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Pricing Page</h4>
            <p className="text-xs text-gray-400">
              {form.enabled ? 'Included in template' : 'Not included in template'}
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
          {form.enabled && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showPreview ? 'bg-[#017C87]/10 text-[#017C87]' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
              }`}
              title={showPreview ? 'Hide preview' : 'Show preview'}
            >
              <Eye size={13} /> Preview
            </button>
          )}
          <Toggle enabled={form.enabled} onChange={() => toggleEnabled()} />
        </div>
      </div>

      {/* Content */}
      {form.enabled ? (
        <div className="flex gap-6">
          {/* Left: Form */}
          <div className={`flex-1 min-w-0 space-y-6 ${showPreview ? 'max-w-[55%]' : 'max-w-3xl'}`}>
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
            <PricingPaymentSchedule
              schedule={form.paymentSchedule}
              items={form.items}
              taxEnabled={form.taxEnabled}
              taxRate={form.taxRate}
              onChange={(paymentSchedule) => updateForm({ paymentSchedule })}
            />
          </div>

          {/* Right: Preview */}
          {showPreview && (
            <div className="w-[45%] shrink-0">
              <PricingPreview pricing={previewPricing} branding={branding} />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <DollarSign size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400 mb-1">Pricing is currently disabled</p>
          <p className="text-xs text-gray-300">Toggle the switch above to add default pricing to this template</p>
        </div>
      )}
    </div>
  );
}