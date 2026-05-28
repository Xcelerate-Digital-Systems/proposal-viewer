// components/admin/shared/usePricingEditor.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ProposalPricing, PricingLineItem, PricingOptionalItem,
  PaymentSchedule, DEFAULT_PAYMENT_SCHEDULE, normalizePaymentSchedule,
} from '@/lib/supabase';
import { CompanyBranding } from '@/hooks/useProposal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { DEFAULT_BRANDING } from '@/lib/branding-defaults';
import { authFetch } from '@/lib/auth-fetch';

/* ─── Internal types ──────────────────────────────────────────── */

interface UnifiedPage {
  id: string;
  entity_id: string;
  company_id: string;
  position: number;
  type: string;
  title: string;
  indent: number;
  enabled: boolean;
  link_url: string | null;
  link_label: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/* ─── Constants ───────────────────────────────────────────────── */

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

/* ─── Form state ──────────────────────────────────────────────── */

export type PricingFormState = {
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
  qtyEnabled: boolean;
  qtyLabel: string;
  showStage: boolean;
  stageLabel: string;
  showDescription: boolean;
  descriptionLabel: string;
  showRate: boolean;
  rateLabel: string;
  showLineTotal: boolean;
  totalLabel: string;
  showSubtotal: boolean;
  showDiscount: boolean;
  showTotal: boolean;
  footerNote: string;
};

const DEFAULT_FORM: PricingFormState = {
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
  qtyEnabled: false,
  qtyLabel: 'Quantity',
  showStage: true,
  stageLabel: 'Item',
  showDescription: true,
  descriptionLabel: 'Description',
  showRate: true,
  rateLabel: '',
  showLineTotal: true,
  totalLabel: '',
  showSubtotal: true,
  showDiscount: true,
  showTotal: true,
  footerNote: '',
};

/* ─── Converters ──────────────────────────────────────────────── */

function unifiedToPricing(page: UnifiedPage): ProposalPricing {
  const pl = page.payload ?? {};
  return {
    id: page.id,
    proposal_id: page.entity_id,
    company_id: page.company_id,
    enabled: page.enabled,
    position: page.position,
    indent: page.indent,
    title: page.title,
    intro_text: (pl.intro_text as string) || DEFAULT_INTRO,
    items: (pl.items as PricingLineItem[]) || [],
    optional_items: (pl.optional_items as PricingOptionalItem[]) || [],
    payment_schedule: normalizePaymentSchedule(pl.payment_schedule),
    tax_enabled: (pl.tax_enabled as boolean) ?? true,
    tax_rate: (pl.tax_rate as number) ?? 10,
    tax_label: (pl.tax_label as string) ?? 'GST (10%)',
    validity_days: (pl.validity_days as number) ?? null,
    proposal_date: (pl.proposal_date as string) || new Date().toISOString().split('T')[0],
    qty_enabled: (pl.qty_enabled as boolean) ?? false,
    qty_label: (pl.qty_label as string) || 'Quantity',
    show_stage: (pl.show_stage as boolean) ?? true,
    stage_label: (pl.stage_label as string) || 'Item',
    show_description: (pl.show_description as boolean) ?? true,
    description_label: (pl.description_label as string) || '',
    show_rate: (pl.show_rate as boolean) ?? true,
    rate_label: (pl.rate_label as string) || '',
    show_line_total: (pl.show_line_total as boolean) ?? true,
    total_label: (pl.total_label as string) || '',
    show_subtotal: (pl.show_subtotal as boolean) ?? true,
    show_discount: (pl.show_discount as boolean) ?? true,
    show_total: (pl.show_total as boolean) ?? true,
    footer_note: (pl.footer_note as string) || '',
    created_at: page.created_at,
    updated_at: page.updated_at,
  };
}

function formFromRecord(record: ProposalPricing): PricingFormState {
  return {
    enabled: record.enabled,
    title: record.title || 'Project Investment',
    introText: record.intro_text || DEFAULT_INTRO,
    items: record.items || [],
    optionalItems: record.optional_items || [],
    paymentSchedule: normalizePaymentSchedule(record.payment_schedule),
    taxEnabled: record.tax_enabled ?? true,
    taxRate: record.tax_rate ?? 10,
    taxLabel: record.tax_label ?? 'GST (10%)',
    validityDays: record.validity_days ?? null,
    proposalDate: record.proposal_date || new Date().toISOString().split('T')[0],
    qtyEnabled: record.qty_enabled ?? false,
    qtyLabel: record.qty_label || 'Quantity',
    showStage: record.show_stage ?? true,
    stageLabel: record.stage_label || 'Item',
    showDescription: record.show_description ?? true,
    descriptionLabel: record.description_label || '',
    showRate: record.show_rate ?? true,
    rateLabel: record.rate_label || '',
    showLineTotal: record.show_line_total ?? true,
    totalLabel: record.total_label || '',
    showSubtotal: record.show_subtotal ?? true,
    showDiscount: record.show_discount ?? true,
    showTotal: record.show_total ?? true,
    footerNote: record.footer_note || '',
  };
}

/* ─── Hook options ────────────────────────────────────────────── */

export interface UsePricingEditorOptions {
  apiBase: string;
  entityKey: 'proposal_id' | 'template_id';
  entityId: string;
  companyId: string | null;
  extraPostFields?: Record<string, string>;
}

/* ─── Hook ────────────────────────────────────────────────────── */

export function usePricingEditor({
  apiBase,
  entityKey,
  entityId,
  companyId,
  extraPostFields,
}: UsePricingEditorOptions) {
  const toast = useToast();
  const confirm = useConfirm();

  const [loaded, setLoaded] = useState(false);
  const [allPages, setAllPages] = useState<ProposalPricing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingFormState>(DEFAULT_FORM);
  const [position, setPosition] = useState(-1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [adding, setAdding] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPage = allPages.find((p) => p.id === selectedId) ?? null;

  /* ── Fetch pricing pages ───────────────────────────────────── */

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await authFetch(`${apiBase}?${entityKey}=${entityId}`);
        if (res.ok) {
          const allPagesData: UnifiedPage[] = await res.json();
          const pages = allPagesData
            .filter((p) => p.type === 'pricing')
            .map(unifiedToPricing);

          setAllPages(pages);
          if (pages.length > 0) {
            const first = pages[0];
            setSelectedId(first.id);
            setForm(formFromRecord(first));
            setPosition(first.position);
            if (!companyId && first.company_id) {
              setResolvedCompanyId(first.company_id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
      }
      setLoaded(true);
    };
    fetchPricing();
  }, [apiBase, entityKey, entityId, companyId]);

  /* ── Fetch branding ─────────────────────────────────────────── */

  useEffect(() => {
    if (!resolvedCompanyId) return;
    const fetchBranding = async () => {
      try {
        const res = await authFetch(`/api/company/branding?company_id=${resolvedCompanyId}`);
        if (res.ok) {
          const data = await res.json();
          setBranding({ ...DEFAULT_BRANDING, ...data });
        }
      } catch {
        /* Use defaults */
      }
    };
    fetchBranding();
  }, [resolvedCompanyId]);

  /* ── Select a page ──────────────────────────────────────────── */

  const selectPage = useCallback((page: ProposalPricing) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelectedId(page.id);
    setForm(formFromRecord(page));
    setPosition(page.position);
    setSaveStatus('idle');
  }, []);

  /* ── Save ───────────────────────────────────────────────────── */

  const savePricing = useCallback(
    async (id: string, data: PricingFormState, pos: number) => {
      setSaveStatus('saving');
      try {
        const res = await authFetch(`${apiBase}?id=${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: data.enabled,
            position: pos,
            title: data.title,
            payload_patch: {
              intro_text: data.introText,
              items: data.items,
              optional_items: data.optionalItems,
              payment_schedule: data.paymentSchedule,
              tax_enabled: data.taxEnabled,
              tax_rate: data.taxRate,
              tax_label: data.taxLabel,
              validity_days: data.validityDays,
              proposal_date: data.proposalDate,
              qty_enabled: data.qtyEnabled,
              qty_label: data.qtyLabel,
              show_stage: data.showStage,
              stage_label: data.stageLabel,
              show_description: data.showDescription,
              description_label: data.descriptionLabel,
              show_rate: data.showRate,
              rate_label: data.rateLabel,
              show_line_total: data.showLineTotal,
              total_label: data.totalLabel,
              show_subtotal: data.showSubtotal,
              show_discount: data.showDiscount,
              show_total: data.showTotal,
              footer_note: data.footerNote,
            },
          }),
        });
        if (res.ok) {
          const updated: UnifiedPage = await res.json();
          const pricing = unifiedToPricing(updated);
          setAllPages((prev) => prev.map((p) => (p.id === id ? pricing : p)));
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('idle');
          toast.error('Failed to save quote');
        }
      } catch {
        setSaveStatus('idle');
        toast.error('Failed to save quote');
      }
    },
    [apiBase, toast],
  );

  const updateForm = useCallback(
    (changes: Partial<PricingFormState>) => {
      if (!selectedId) return;
      const id = selectedId;
      setForm((prev) => {
        const next = { ...prev, ...changes };
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => savePricing(id, next, position), 800);
        return next;
      });
    },
    [selectedId, position, savePricing],
  );

  /* ── Toggle enabled ─────────────────────────────────────────── */

  const toggleEnabled = useCallback(async () => {
    if (!selectedId) return;
    const newEnabled = !form.enabled;
    const next = { ...form, enabled: newEnabled };
    setForm(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await savePricing(selectedId, next, position);
    toast.success(newEnabled ? 'Quote page enabled' : 'Quote page disabled');
  }, [selectedId, form, position, savePricing, toast]);

  /* ── Add page ───────────────────────────────────────────────── */

  const addPage = useCallback(async () => {
    setAdding(true);
    try {
      const res = await authFetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [entityKey]: entityId,
          ...extraPostFields,
          type: 'pricing',
          enabled: true,
          title: 'Project Investment',
          payload: {
            intro_text: DEFAULT_INTRO,
            items: [],
            optional_items: [],
            payment_schedule: DEFAULT_PAYMENT_SCHEDULE,
            tax_enabled: true,
            tax_rate: 10,
            tax_label: 'GST (10%)',
            validity_days: 30,
            proposal_date: new Date().toISOString().split('T')[0],
            qty_enabled: false,
            qty_label: 'Qty',
            show_stage: true,
            stage_label: 'Stage',
            show_description: true,
            description_label: '',
            show_rate: true,
            rate_label: '',
            show_line_total: true,
            total_label: '',
            show_subtotal: true,
            show_discount: true,
            show_total: true,
            footer_note: '',
          },
        }),
      });
      if (res.ok) {
        const created: UnifiedPage = await res.json();
        const pricing = unifiedToPricing(created);
        if (!resolvedCompanyId && pricing.company_id) {
          setResolvedCompanyId(pricing.company_id);
        }
        setAllPages((prev) => [...prev, pricing]);
        selectPage(pricing);
        toast.success('Quote page added');
      } else {
        toast.error('Failed to add quote page');
      }
    } catch {
      toast.error('Failed to add quote page');
    }
    setAdding(false);
  }, [apiBase, entityKey, entityId, extraPostFields, resolvedCompanyId, selectPage, toast]);

  /* ── Delete page ────────────────────────────────────────────── */

  const deletePage = useCallback(
    async (id: string) => {
      const ok = await confirm({ title: 'Delete page', message: 'Delete this quote page? This cannot be undone.', confirmLabel: 'Delete', destructive: true });
      if (!ok) return;
      try {
        const res = await authFetch(apiBase, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [entityKey]: entityId, page_id: id }),
        });
        if (!res.ok) {
          toast.error('Failed to delete quote page');
          return;
        }
      } catch {
        toast.error('Failed to delete quote page');
        return;
      }

      setAllPages((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (selectedId === id) {
          if (remaining.length > 0) selectPage(remaining[0]);
          else setSelectedId(null);
        }
        return remaining;
      });
      toast.success('Quote page deleted');
    },
    [apiBase, entityKey, entityId, selectedId, selectPage, toast],
  );

  /* ── Preview data ───────────────────────────────────────────── */

  const previewPricing: ProposalPricing | null = selectedPage
    ? {
        ...selectedPage,
        enabled: form.enabled,
        title: form.title,
        intro_text: form.introText,
        items: form.items,
        optional_items: form.optionalItems,
        payment_schedule: form.paymentSchedule,
        tax_enabled: form.taxEnabled,
        tax_rate: form.taxRate,
        tax_label: form.taxLabel,
        validity_days: form.validityDays,
        proposal_date: form.proposalDate,
        qty_enabled: form.qtyEnabled,
        qty_label: form.qtyLabel,
        show_stage: form.showStage,
        stage_label: form.stageLabel,
        show_description: form.showDescription,
        description_label: form.descriptionLabel,
        show_rate: form.showRate,
        rate_label: form.rateLabel,
        show_line_total: form.showLineTotal,
        total_label: form.totalLabel,
        show_subtotal: form.showSubtotal,
        show_discount: form.showDiscount,
        show_total: form.showTotal,
        footer_note: form.footerNote,
      }
    : null;

  return {
    // Loading
    loaded,
    adding,

    // Pages
    allPages,
    selectedId,
    selectedPage,
    selectPage,
    addPage,
    deletePage,

    // Form
    form,
    updateForm,
    toggleEnabled,
    saveStatus,

    // Preview
    branding,
    previewPricing,
  };
}
