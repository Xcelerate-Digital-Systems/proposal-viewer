// components/admin/builder-sections/PricingSection.tsx
// Quote-style replacement for PricingTabEditor. Same data layer
// (usePricingEditor + the PricingSettings / PricingLineItems / etc. bodies),
// wrapped in SectionCard chrome to match the Quote builder aesthetic.
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  DollarSign, Loader2, MapPin,
  Settings as SettingsIcon, ListChecks, PlusSquare, Calculator, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Toggle from '@/components/ui/Toggle';
import Chip from '@/components/ui/Chip';
import PricingPreview from '@/components/admin/shared/PricingPreview';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';
import PricingSettings from '@/components/admin/pricing/PricingSettings';
import PricingLineItems from '@/components/admin/pricing/PricingLineItems';
import PricingOptionalItems from '@/components/admin/pricing/PricingOptionalItems';
import PricingTotals from '@/components/admin/pricing/PricingTotals';
import PricingPaymentSchedule from '@/components/admin/pricing/PricingPaymentSchedule';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import BuilderPageStrip from '@/components/admin/shared/BuilderPageStrip';
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
        <Loader2 size={18} className="animate-spin text-faint" />
      </div>
    );
  }

  /* ── Page strip (multi-page support) ───────────────────────── */

  const pageStrip = (
    <BuilderPageStrip
      pages={editor.allPages}
      selectedId={editor.selectedId}
      onSelect={(p) => {
        const full = editor.allPages.find((x) => x.id === p.id);
        if (full) editor.selectPage(full);
      }}
      onDelete={editor.deletePage}
      onAdd={editor.addPage}
      adding={editor.adding}
      icon={DollarSign}
      previewVisible={showPreview}
      onTogglePreview={hidePreview ? undefined : () => setShowPreview(!showPreview)}
    />
  );

  /* ── Empty / disabled states ──────────────────────────────── */

  if (!editor.selectedId || !editor.selectedPage) {
    return (
      <div className="space-y-5">
        {pageStrip}
        <div className="bg-white rounded-2xl border border-edge-strong py-16 text-center">
          <DollarSign size={28} className="mx-auto text-edge-hover mb-3" />
          <p className="text-sm text-faint mb-1">No quote page selected</p>
          <p className="text-xs text-faint">Select a page from the list or add a new one</p>
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
            icon={<DollarSign size={14} className="text-faint" />}
            action={
              <Chip enabled={editor.form.enabled} onClick={() => editor.toggleEnabled()}>
                {editor.form.enabled ? 'Visible' : 'Hidden'}
              </Chip>
            }
          >
            {!editor.form.enabled && (
              <div className="rounded-lg border border-dashed border-edge-strong bg-surface py-8 text-center">
                <p className="text-sm text-faint mb-1">Quote page is currently disabled</p>
                <p className="text-xs text-faint">Toggle the switch above to enable it</p>
              </div>
            )}
            {editor.form.enabled && (
              <p className="text-xs text-faint">
                Configure the quote page below. Changes save automatically.
              </p>
            )}
          </SectionCard>

          {editor.form.enabled && (
            <>
              <SectionCard
                title="Settings"
                description="Title, intro, columns, and label customisation"
                icon={<SettingsIcon size={14} className="text-faint" />}
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
                icon={<ListChecks size={14} className="text-faint" />}
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
                icon={<PlusSquare size={14} className="text-faint" />}
              >
                <PricingOptionalItems
                  items={editor.form.optionalItems}
                  onChange={(optionalItems) => editor.updateForm({ optionalItems })}
                />
              </SectionCard>

              <SectionCard
                title="Totals"
                description="Subtotal, tax, and grand total preview"
                icon={<Calculator size={14} className="text-faint" />}
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
                icon={<Calendar size={14} className="text-faint" />}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-edge">
                    <div>
                      <p className="text-sm font-medium text-prose">Include GST</p>
                      <p className="text-xs text-faint">10% Goods and Services Tax applied to the total</p>
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
                  icon={<MapPin size={14} className="text-faint" />}
                  action={<Toggle enabled={showJobFields} onChange={toggleJobFields} size="sm" />}
                >
                  {showJobFields ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-prose mb-1">Site / Job Address</label>
                        <input
                          type="text"
                          value={jobFields.site_address}
                          onChange={(e) => updateJobField('site_address', e.target.value)}
                          placeholder="123 Main St, Suburb VIC 3000"
                          className="w-full px-3 py-2.5 rounded-lg border border-edge-strong bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-prose mb-1">Estimated Start Date</label>
                          <input
                            type="date"
                            value={jobFields.estimated_start_date}
                            onChange={(e) => updateJobField('estimated_start_date', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-edge-strong bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-prose mb-1">Estimated Duration</label>
                          <input
                            type="text"
                            value={jobFields.estimated_duration}
                            onChange={(e) => updateJobField('estimated_duration', e.target.value)}
                            placeholder="e.g. 2-3 weeks"
                            className="w-full px-3 py-2.5 rounded-lg border border-edge-strong bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-faint">Toggle on to surface site / job details on the quote page.</p>
                  )}
                </SectionCard>
              )}
            </>
          )}
        </div>

        {showPreviewPane && (
          <StickyPreviewAside>
            <PricingPreview pricing={editor.previewPricing!} branding={editor.branding} />
          </StickyPreviewAside>
        )}
      </div>
    </div>
  );
}
