// components/admin/proposals/PricingTab.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, DollarSign, Loader2, Eye } from 'lucide-react';
import {
  ProposalPricing, PricingLineItem, PricingOptionalItem,
  PaymentSchedule, DEFAULT_PAYMENT_SCHEDULE, normalizePaymentSchedule, supabase,
} from '@/lib/supabase';
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
import SplitPanelLayout from '@/components/admin/shared/SplitPanelLayout';

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

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface PricingTabProps {
  proposalId: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PricingTab({ proposalId }: PricingTabProps) {
  const toast = useToast();

  const [loaded, setLoaded]           = useState(false);
  const [exists, setExists]           = useState(false);
  const [pageId, setPageId]           = useState<string | null>(null);
  const [position, setPosition]       = useState(-1);
  const [form, setForm]               = useState<PricingFormState>(DEFAULT_PRICING);
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'saving' | 'saved'>('idle');
  const [branding, setBranding]       = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [showPreview, setShowPreview] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Panel height measurement (matches DesignTab / PackagesTab) ─ */

  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(520);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPanelHeight(Math.max(400, window.innerHeight - rect.top - 32));
      }
    };
    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, []);

  /* ── Fetch pricing ──────────────────────────────────────────── */

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/proposals/pages?proposal_id=${proposalId}`);
        if (res.ok) {
          const allPages = await res.json();
          const data = allPages.find((p: { type: string }) => p.type === 'pricing') ?? null;
          if (data) {
            const pl = data.payload ?? {};
            setExists(true);
            setPageId(data.id);
            setPosition(data.position);
            setForm({
              enabled:         data.enabled,
              title:           data.title,
              introText:       (pl.intro_text as string) || DEFAULT_INTRO,
              items:           (pl.items as PricingLineItem[]) || [],
              optionalItems:   (pl.optional_items as PricingOptionalItem[]) || [],
              paymentSchedule: normalizePaymentSchedule(pl.payment_schedule),
              taxEnabled:      (pl.tax_enabled as boolean) ?? true,
              taxRate:         (pl.tax_rate as number) ?? 10,
              taxLabel:        (pl.tax_label as string) ?? 'GST (10%)',
              validityDays:    (pl.validity_days as number) ?? null,
              proposalDate:    (pl.proposal_date as string) || new Date().toISOString().split('T')[0],
            });
          }
        }
      } catch { /* no pricing yet */ }
      setLoaded(true);
    };
    fetchPricing();
  }, [proposalId]);

  /* ── Fetch branding ─────────────────────────────────────────── */

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const { data: proposal } = await supabase
          .from('proposals')
          .select('company_id')
          .eq('id', proposalId)
          .single();
        if (proposal?.company_id) {
          const res = await fetch(`/api/company/branding?company_id=${proposal.company_id}`);
          if (res.ok) {
            const data = await res.json();
            setBranding({ ...DEFAULT_BRANDING, ...data });
          }
        }
      } catch { /* Use defaults */ }
    };
    fetchBranding();
  }, [proposalId]);

  /* ── Save ───────────────────────────────────────────────────── */

  const savePricing = useCallback(async (formData: PricingFormState, id: string) => {
    setSaveStatus('saving');
    try {
      await fetch(`/api/proposals/pages?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: formData.enabled,
          title:   formData.title,
          payload_patch: {
            intro_text:       formData.introText,
            items:            formData.items,
            optional_items:   formData.optionalItems,
            payment_schedule: formData.paymentSchedule,
            tax_enabled:      formData.taxEnabled,
            tax_rate:         formData.taxRate,
            tax_label:        formData.taxLabel,
            validity_days:    formData.validityDays,
            proposal_date:    formData.proposalDate,
          },
        }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      toast.error('Failed to save pricing');
      setSaveStatus('idle');
    }
  }, [toast]);

  const updateForm = useCallback((changes: Partial<PricingFormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...changes };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (pageId) savePricing(next, pageId);
        debounceRef.current = null;
      }, 800);
      return next;
    });
  }, [savePricing, pageId]);

  /* ── Toggle enabled ─────────────────────────────────────────── */

  const toggleEnabled = useCallback(async () => {
    if (!pageId) return; // no pricing page — add one via the page editor
    const newEnabled = !form.enabled;
    const updated = { ...form, enabled: newEnabled };
    setForm(updated);
    await savePricing(updated, pageId);
    toast.success(newEnabled ? 'Pricing page enabled' : 'Pricing page disabled');
  }, [form, pageId, savePricing, toast]);

  /* ── Build preview data ─────────────────────────────────────── */

  const previewPricing: ProposalPricing = {
    id:               'preview',
    proposal_id:      proposalId,
    company_id:       '',
    enabled:          form.enabled,
    position,
    indent:           0,
    title:            form.title,
    intro_text:       form.introText,
    items:            form.items,
    optional_items:   form.optionalItems,
    payment_schedule: form.paymentSchedule,
    tax_enabled:      form.taxEnabled,
    tax_rate:         form.taxRate,
    tax_label:        form.taxLabel,
    validity_days:    form.validityDays,
    proposal_date:    form.proposalDate,
    created_at:       '',
    updated_at:       '',
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
              {exists
                ? form.enabled ? 'Included in proposal' : 'Not included in proposal'
                : 'No pricing page — add one via the page editor'}
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
          {form.enabled && exists && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showPreview
                  ? 'bg-[#017C87]/10 text-[#017C87]'
                  : 'bg-gray-100 text-gray-400 hover:text-gray-600'
              }`}
              title={showPreview ? 'Hide preview' : 'Show preview'}
            >
              <Eye size={13} /> Preview
            </button>
          )}
          {exists && <Toggle enabled={form.enabled} onChange={() => toggleEnabled()} />}
        </div>
      </div>

      {/* Content */}
      {!exists ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <DollarSign size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400 mb-1">No pricing page found</p>
          <p className="text-xs text-gray-300">Add a pricing page via the page editor, then return here to configure it</p>
        </div>
      ) : form.enabled ? (
        <SplitPanelLayout
          containerRef={containerRef}
          panelHeight={panelHeight}
          leftClassName={`overflow-y-auto space-y-6 pr-2 ${!showPreview ? 'max-w-3xl' : ''}`}
          rightClassName="flex flex-col"
          left={
            <>
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
            </>
          }
          right={showPreview ? <PricingPreview pricing={previewPricing} branding={branding} /> : undefined}
        />
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