// components/admin/shared/PricingTabEditor.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, DollarSign, Loader2, Plus, Trash2, Eye } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import PricingPreview from '@/components/admin/shared/PricingPreview';
import PricingSettings from '@/components/admin/pricing/PricingSettings';
import PricingLineItems from '@/components/admin/pricing/PricingLineItems';
import PricingOptionalItems from '@/components/admin/pricing/PricingOptionalItems';
import PricingTotals from '@/components/admin/pricing/PricingTotals';
import PricingPaymentSchedule from '@/components/admin/pricing/PricingPaymentSchedule';
import SplitPanelLayout from '@/components/admin/shared/SplitPanelLayout';
import { usePricingEditor, type UsePricingEditorOptions } from './usePricingEditor';

/* ─── Props ───────────────────────────────────────────────────── */

export type PricingTabEditorProps = UsePricingEditorOptions & {
  /** Hide proposal_date for templates */
  hideProposalDate?: boolean;
};

/* ─── Component ───────────────────────────────────────────────── */

export default function PricingTabEditor({ hideProposalDate, ...props }: PricingTabEditorProps) {
  const editor = usePricingEditor(props);

  const containerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(520);
  const [showPreview, setShowPreview] = useState(true);

  /* ── Panel height ───────────────────────────────────────────── */

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const top = containerRef.current.getBoundingClientRect().top;
        setPanelHeight(Math.max(400, window.innerHeight - top - 24));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* ── Loading ────────────────────────────────────────────────── */

  if (!editor.loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Quote Pages</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {editor.allPages.length === 0
              ? 'No quote pages yet'
              : `${editor.allPages.filter((p) => p.enabled).length} of ${editor.allPages.length} enabled`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editor.saveStatus === 'saving' && <Loader2 size={14} className="animate-spin text-gray-300" />}
          {editor.saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check size={12} /> Saved
            </span>
          )}
          {editor.selectedId && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showPreview
                  ? 'bg-teal/10 text-teal'
                  : 'bg-gray-100 text-gray-400 hover:text-gray-600'
              }`}
            >
              <Eye size={13} /> Preview
            </button>
          )}
        </div>
      </div>

      {/* Page navigation tabs */}
      <div className="flex items-end gap-0 border-b border-gray-200 overflow-x-auto mb-5">
        {editor.allPages.map((page) => (
          <button
            key={page.id}
            onClick={() => editor.selectPage(page)}
            className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              editor.selectedId === page.id
                ? 'text-teal border-b-2 border-teal -mb-px bg-teal/5'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent -mb-px'
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
      </div>

      {/* Body: editor + optional preview */}
      <SplitPanelLayout
        containerRef={containerRef}
        panelHeight={panelHeight}
        gap="gap-5"
        leftClassName="overflow-y-auto"
        left={
          editor.selectedId && editor.selectedPage ? (
            <>
              {/* Enabled toggle */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Show quote page</p>
                  <p className="text-xs text-gray-400 mt-0.5">Toggle visibility in the proposal viewer</p>
                </div>
                <Toggle enabled={editor.form.enabled} onChange={() => editor.toggleEnabled()} />
              </div>

              {editor.form.enabled ? (
                <div className="space-y-6">
                  <PricingSettings
                    title={editor.form.title}
                    introText={editor.form.introText}
                    taxEnabled={editor.form.taxEnabled}
                    validityDays={editor.form.validityDays}
                    proposalDate={hideProposalDate ? new Date().toISOString().split('T')[0] : editor.form.proposalDate}
                    qtyEnabled={editor.form.qtyEnabled}
                    qtyLabel={editor.form.qtyLabel}
                    onTitleChange={(v) => editor.updateForm({ title: v })}
                    onIntroTextChange={(v) => editor.updateForm({ introText: v })}
                    onTaxEnabledChange={(v) => editor.updateForm({ taxEnabled: v })}
                    onValidityDaysChange={(v) => editor.updateForm({ validityDays: v })}
                    onProposalDateChange={hideProposalDate ? () => {} : (v) => editor.updateForm({ proposalDate: v })}
                    onQtyEnabledChange={(v) => editor.updateForm({ qtyEnabled: v })}
                    onQtyLabelChange={(v) => editor.updateForm({ qtyLabel: v })}
                  />
                  <PricingLineItems
                    items={editor.form.items}
                    onChange={(items) => editor.updateForm({ items })}
                    qtyEnabled={editor.form.qtyEnabled}
                    qtyLabel={editor.form.qtyLabel}
                    footerNote={editor.form.footerNote}
                    onFooterNoteChange={(v) => editor.updateForm({ footerNote: v })}
                  />
                  <PricingOptionalItems
                    items={editor.form.optionalItems}
                    onChange={(optionalItems) => editor.updateForm({ optionalItems })}
                  />
                  <PricingTotals
                    items={editor.form.items}
                    taxEnabled={editor.form.taxEnabled}
                    taxRate={editor.form.taxRate}
                    taxLabel={editor.form.taxLabel}
                  />
                  <PricingPaymentSchedule
                    schedule={editor.form.paymentSchedule}
                    items={editor.form.items}
                    taxEnabled={editor.form.taxEnabled}
                    taxRate={editor.form.taxRate}
                    onChange={(paymentSchedule) => editor.updateForm({ paymentSchedule })}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
                  <DollarSign size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400 mb-1">Quote page is currently disabled</p>
                  <p className="text-xs text-gray-300">Toggle the switch above to enable it</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <DollarSign size={28} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400 mb-1">No quote page selected</p>
                <p className="text-xs text-gray-300">Select a page from the list or add a new one</p>
              </div>
            </div>
          )
        }
        right={
          showPreview && editor.selectedId && editor.form.enabled && editor.previewPricing ? (
            <PricingPreview pricing={editor.previewPricing} branding={editor.branding} />
          ) : undefined
        }
      />
    </div>
  );
}
