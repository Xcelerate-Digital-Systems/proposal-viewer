// components/admin/builder-sections/PricingSection.tsx
// Quote-style replacement for PricingTabEditor. Same data layer
// (usePricingEditor + the PricingSettings / PricingLineItems / etc. bodies),
// wrapped in SectionCard chrome to match the Quote builder aesthetic.
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  DollarSign, Loader2, Plus, Trash2, Eye, MapPin,
  Settings as SettingsIcon, ListChecks, PlusSquare, Calculator, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Toggle from '@/components/ui/Toggle';
import PricingPreview from '@/components/admin/shared/PricingPreview';
import PricingSettings from '@/components/admin/pricing/PricingSettings';
import PricingLineItems from '@/components/admin/pricing/PricingLineItems';
import PricingOptionalItems from '@/components/admin/pricing/PricingOptionalItems';
import PricingTotals from '@/components/admin/pricing/PricingTotals';
import PricingPaymentSchedule from '@/components/admin/pricing/PricingPaymentSchedule';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import { usePricingEditor, type UsePricingEditorOptions } from '@/components/admin/shared/usePricingEditor';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import type { PricingLineItem } from '@/lib/types/packages';

export type PricingSectionProps = UsePricingEditorOptions & {
  hideProposalDate?: boolean;
  /** Proposal ID — enables the job/site fields card (omit for templates) */
  proposalId?: string;
  /** Optional slot rendered inside the Line Items card header. */
  lineItemsToolbar?: (api: {
    items: PricingLineItem[];
    replaceItems: (items: PricingLineItem[]) => void;
  }) => ReactNode;
  hidePreview?: boolean;
};

export default function PricingSection({
  hideProposalDate,
  proposalId,
  lineItemsToolbar,
  hidePreview,
  ...props
}: PricingSectionProps) {
  const editor = usePricingEditor(props);
  useReportSaveStatus(editor.saveStatus);

  const [showPreview, setShowPreview] = useState(!hidePreview);

  /* ── Job fields (per-proposal toggle) ──────────────────────── */

  const [showJobFields, setShowJobFields] = useState(false);
  const [jobFields, setJobFields] = useState({
    site_address: '',
    estimated_start_date: '',
    estimated_duration: '',
  });

  const fetchJobFields = useCallback(async () => {
    if (!proposalId) return;
    const { data } = await supabase
      .from('proposals')
      .select('show_job_fields, site_address, estimated_start_date, estimated_duration')
      .eq('id', proposalId)
      .single();
    if (data) {
      setShowJobFields(data.show_job_fields ?? false);
      setJobFields({
        site_address: data.site_address || '',
        estimated_start_date: data.estimated_start_date || '',
        estimated_duration: data.estimated_duration || '',
      });
    }
  }, [proposalId]);

  useEffect(() => { fetchJobFields(); }, [fetchJobFields]);

  const toggleJobFields = async () => {
    if (!proposalId) return;
    const newVal = !showJobFields;
    setShowJobFields(newVal);
    await supabase.from('proposals').update({ show_job_fields: newVal }).eq('id', proposalId);
  };

  const jobFieldDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateJobField = (key: string, value: string) => {
    setJobFields((prev) => ({ ...prev, [key]: value }));
    if (jobFieldDebounce.current) clearTimeout(jobFieldDebounce.current);
    jobFieldDebounce.current = setTimeout(async () => {
      if (proposalId) {
        await supabase.from('proposals').update({ [key]: value || null }).eq('id', proposalId);
      }
    }, 800);
  };

  /* ── Loading ────────────────────────────────────────────────── */

  if (!editor.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  /* ── Page strip (multi-page support) ───────────────────────── */

  const pageStrip = (
    <div className="flex items-end gap-0 border-b border-gray-200 overflow-x-auto">
      {editor.allPages.map((page) => (
        <button
          key={page.id}
          onClick={() => editor.selectPage(page)}
          className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
            editor.selectedId === page.id
              ? 'text-teal border-b-2 border-teal -mb-px'
              : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px'
          }`}
        >
          <DollarSign size={13} className="shrink-0 opacity-70" />
          <span className="truncate max-w-[160px]">{page.title || 'Untitled'}</span>
          {!page.enabled && <span className="text-[10px] opacity-40 ml-0.5">(off)</span>}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); editor.deletePage(page.id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all"
          >
            <Trash2 size={11} />
          </span>
        </button>
      ))}
      {editor.allPages.length === 0 && (
        <span className="px-4 py-2.5 text-xs text-gray-400">No pages yet — add one to get started</span>
      )}
      <button
        onClick={editor.addPage}
        disabled={editor.adding}
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/5 transition-colors disabled:opacity-50 shrink-0 border-b-2 border-transparent -mb-px"
      >
        {editor.adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Add Page
      </button>
      {editor.selectedId && !hidePreview && (
        <div className="ml-auto flex items-center pr-1 pb-1.5">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showPreview ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400 hover:text-gray-600'
            }`}
          >
            <Eye size={13} /> Preview
          </button>
        </div>
      )}
    </div>
  );

  /* ── Empty / disabled states ──────────────────────────────── */

  if (!editor.selectedId || !editor.selectedPage) {
    return (
      <div className="space-y-5">
        {pageStrip}
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <DollarSign size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400 mb-1">No quote page selected</p>
          <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
        </div>
      </div>
    );
  }

  /* ── Editor + preview ─────────────────────────────────────── */

  const showPreviewPane = showPreview && editor.form.enabled && !!editor.previewPricing;

  return (
    <div className="flex flex-col gap-5">
      {pageStrip}

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-5">
          {/* Page enabled toggle */}
          <SectionCard
            title="Quote Page"
            description="Toggle visibility in the proposal viewer"
            icon={<DollarSign size={14} className="text-gray-400" />}
            action={
              <Toggle enabled={editor.form.enabled} onChange={() => editor.toggleEnabled()} />
            }
          >
            {!editor.form.enabled && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                <p className="text-sm text-gray-400 mb-1">Quote page is currently disabled</p>
                <p className="text-xs text-gray-300">Toggle the switch above to enable it</p>
              </div>
            )}
            {editor.form.enabled && (
              <p className="text-xs text-gray-400">
                Configure the quote page below. Changes save automatically.
              </p>
            )}
          </SectionCard>

          {editor.form.enabled && (
            <>
              <SectionCard
                title="Settings"
                description="Title, intro, columns, and label customisation"
                icon={<SettingsIcon size={14} className="text-gray-400" />}
              >
                <PricingSettings
                  title={editor.form.title}
                  introText={editor.form.introText}
                  taxEnabled={editor.form.taxEnabled}
                  validityDays={editor.form.validityDays}
                  proposalDate={hideProposalDate ? new Date().toISOString().split('T')[0] : editor.form.proposalDate}
                  qtyEnabled={editor.form.qtyEnabled}
                  qtyLabel={editor.form.qtyLabel}
                  showStage={editor.form.showStage}
                  stageLabel={editor.form.stageLabel}
                  showDescription={editor.form.showDescription}
                  descriptionLabel={editor.form.descriptionLabel}
                  showRate={editor.form.showRate}
                  rateLabel={editor.form.rateLabel}
                  showLineTotal={editor.form.showLineTotal}
                  totalLabel={editor.form.totalLabel}
                  showSubtotal={editor.form.showSubtotal}
                  showDiscount={editor.form.showDiscount}
                  showTotal={editor.form.showTotal}
                  onTitleChange={(v) => editor.updateForm({ title: v })}
                  onIntroTextChange={(v) => editor.updateForm({ introText: v })}
                  onTaxEnabledChange={(v) => editor.updateForm({ taxEnabled: v })}
                  onValidityDaysChange={(v) => editor.updateForm({ validityDays: v })}
                  onProposalDateChange={hideProposalDate ? () => {} : (v) => editor.updateForm({ proposalDate: v })}
                  onQtyEnabledChange={(v) => editor.updateForm({ qtyEnabled: v })}
                  onQtyLabelChange={(v) => editor.updateForm({ qtyLabel: v })}
                  onShowStageChange={(v) => editor.updateForm({ showStage: v })}
                  onStageLabelChange={(v) => editor.updateForm({ stageLabel: v })}
                  onShowDescriptionChange={(v) => editor.updateForm({ showDescription: v })}
                  onDescriptionLabelChange={(v) => editor.updateForm({ descriptionLabel: v })}
                  onShowRateChange={(v) => editor.updateForm({ showRate: v })}
                  onRateLabelChange={(v) => editor.updateForm({ rateLabel: v })}
                  onShowLineTotalChange={(v) => editor.updateForm({ showLineTotal: v })}
                  onTotalLabelChange={(v) => editor.updateForm({ totalLabel: v })}
                  onShowSubtotalChange={(v) => editor.updateForm({ showSubtotal: v })}
                  onShowDiscountChange={(v) => editor.updateForm({ showDiscount: v })}
                  onShowTotalChange={(v) => editor.updateForm({ showTotal: v })}
                />
              </SectionCard>

              <SectionCard
                title="Line Items"
                description="The main scope of works billed in this quote"
                icon={<ListChecks size={14} className="text-gray-400" />}
                action={lineItemsToolbar?.({
                  items: editor.form.items,
                  replaceItems: (items) => editor.updateForm({ items }),
                })}
              >
                <PricingLineItems
                  items={editor.form.items}
                  onChange={(items) => editor.updateForm({ items })}
                  qtyEnabled={editor.form.qtyEnabled}
                  qtyLabel={editor.form.qtyLabel}
                  stageLabel={editor.form.stageLabel}
                  descriptionLabel={editor.form.descriptionLabel}
                  rateLabel={editor.form.rateLabel}
                  footerNote={editor.form.footerNote}
                  onFooterNoteChange={(v) => editor.updateForm({ footerNote: v })}
                />
              </SectionCard>

              <SectionCard
                title="Optional Items"
                description="Add-ons the client can choose to include"
                icon={<PlusSquare size={14} className="text-gray-400" />}
              >
                <PricingOptionalItems
                  items={editor.form.optionalItems}
                  onChange={(optionalItems) => editor.updateForm({ optionalItems })}
                />
              </SectionCard>

              <SectionCard
                title="Totals"
                description="Subtotal, tax, and grand total preview"
                icon={<Calculator size={14} className="text-gray-400" />}
              >
                <PricingTotals
                  items={editor.form.items}
                  taxEnabled={editor.form.taxEnabled}
                  taxRate={editor.form.taxRate}
                  taxLabel={editor.form.taxLabel}
                />
              </SectionCard>

              <SectionCard
                title="Payment & Tax"
                description="GST and the deposit / milestone breakdown"
                icon={<Calendar size={14} className="text-gray-400" />}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Include GST</p>
                      <p className="text-xs text-gray-400">10% Goods and Services Tax applied to the total</p>
                    </div>
                    <Toggle enabled={editor.form.taxEnabled} onChange={(v) => editor.updateForm({ taxEnabled: v })} size="sm" />
                  </div>

                  <PricingPaymentSchedule
                    schedule={editor.form.paymentSchedule}
                    items={editor.form.items}
                    taxEnabled={editor.form.taxEnabled}
                    taxRate={editor.form.taxRate}
                    onChange={(paymentSchedule) => editor.updateForm({ paymentSchedule })}
                  />
                </div>
              </SectionCard>

              {proposalId && (
                <SectionCard
                  title="Job / Site Details"
                  description="Site address, start date, and duration"
                  icon={<MapPin size={14} className="text-gray-400" />}
                  action={<Toggle enabled={showJobFields} onChange={toggleJobFields} size="sm" />}
                >
                  {showJobFields ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Site / Job Address</label>
                        <input
                          type="text"
                          value={jobFields.site_address}
                          onChange={(e) => updateJobField('site_address', e.target.value)}
                          placeholder="123 Main St, Suburb VIC 3000"
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Start Date</label>
                          <input
                            type="date"
                            value={jobFields.estimated_start_date}
                            onChange={(e) => updateJobField('estimated_start_date', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Duration</label>
                          <input
                            type="text"
                            value={jobFields.estimated_duration}
                            onChange={(e) => updateJobField('estimated_duration', e.target.value)}
                            placeholder="e.g. 2-3 weeks"
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Toggle on to surface site / job details on the quote page.</p>
                  )}
                </SectionCard>
              )}
            </>
          )}
        </div>

        {showPreviewPane && (
          <aside className="hidden lg:block w-[520px] xl:w-[620px] 2xl:w-[700px] shrink-0">
            <div className="sticky top-6">
              <PricingPreview pricing={editor.previewPricing!} branding={editor.branding} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
