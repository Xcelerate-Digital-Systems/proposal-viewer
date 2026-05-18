// components/admin/pricing/PricingSettings.tsx
'use client';

import { Check, X } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';

const INPUT_CLS = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40';
const LABEL_INPUT_CLS = 'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal/30';

interface PricingSettingsProps {
  title: string;
  introText: string;
  taxEnabled: boolean;
  validityDays: number | null;
  proposalDate: string | null;
  qtyEnabled: boolean;
  qtyLabel: string;
  showStage?: boolean;
  stageLabel?: string;
  showDescription?: boolean;
  descriptionLabel?: string;
  showRate?: boolean;
  rateLabel?: string;
  showLineTotal?: boolean;
  totalLabel?: string;
  showSubtotal?: boolean;
  showDiscount?: boolean;
  showTotal?: boolean;
  onTitleChange: (v: string) => void;
  onIntroTextChange: (v: string) => void;
  onTaxEnabledChange: (v: boolean) => void;
  onValidityDaysChange: (v: number | null) => void;
  onProposalDateChange: (v: string) => void;
  onQtyEnabledChange: (v: boolean) => void;
  onQtyLabelChange: (v: string) => void;
  onShowStageChange?: (v: boolean) => void;
  onStageLabelChange?: (v: string) => void;
  onShowDescriptionChange?: (v: boolean) => void;
  onDescriptionLabelChange?: (v: string) => void;
  onShowRateChange?: (v: boolean) => void;
  onRateLabelChange?: (v: string) => void;
  onShowLineTotalChange?: (v: boolean) => void;
  onTotalLabelChange?: (v: string) => void;
  onShowSubtotalChange?: (v: boolean) => void;
  onShowDiscountChange?: (v: boolean) => void;
  onShowTotalChange?: (v: boolean) => void;
}

/* ─── Chip ──────────────────────────────────────────────────────── */

function Chip({
  enabled, onClick, children, disabled,
}: {
  enabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
        enabled
          ? 'bg-teal/10 border-teal/30 text-teal hover:bg-teal/15'
          : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
      }`}
    >
      {enabled ? <Check size={11} className="shrink-0" /> : <X size={11} className="shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/* ─── Column row (chip + label input in a 2-col grid) ───────────── */

function ColumnRow({
  enabled, onToggle, name, label, onLabelChange, labelPlaceholder,
}: {
  enabled: boolean;
  onToggle: () => void;
  name: string;
  label?: string;
  onLabelChange?: (v: string) => void;
  labelPlaceholder?: string;
}) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 items-center">
      <Chip enabled={enabled} onClick={onToggle}>{name}</Chip>
      {enabled && onLabelChange ? (
        <input
          type="text"
          value={label ?? ''}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={labelPlaceholder ?? name}
          className={LABEL_INPUT_CLS}
        />
      ) : (
        <span className="text-xs text-gray-300 italic">Hidden</span>
      )}
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function PricingSettings({
  title, introText, taxEnabled, validityDays, proposalDate, qtyEnabled, qtyLabel,
  showStage, stageLabel, showDescription, descriptionLabel, showRate, rateLabel,
  showLineTotal, totalLabel, showSubtotal, showDiscount, showTotal,
  onTitleChange, onIntroTextChange, onTaxEnabledChange, onValidityDaysChange, onProposalDateChange,
  onQtyEnabledChange, onQtyLabelChange, onShowStageChange, onStageLabelChange,
  onShowDescriptionChange, onDescriptionLabelChange,
  onShowRateChange, onRateLabelChange,
  onShowLineTotalChange, onTotalLabelChange,
  onShowSubtotalChange, onShowDiscountChange, onShowTotalChange,
}: PricingSettingsProps) {
  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
        <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Project Investment" className={INPUT_CLS} />
      </div>

      {/* Intro text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Introduction Text</label>
        <textarea value={introText} onChange={(e) => onIntroTextChange(e.target.value)} rows={3} className={`${INPUT_CLS} resize-none`} />
      </div>

      {/* Date & Validity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quote Date</label>
          <input type="date" value={proposalDate ?? ''} onChange={(e) => onProposalDateChange(e.target.value)} className={INPUT_CLS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valid For (days)</label>
          <input type="number" value={validityDays ?? ''} onChange={(e) => onValidityDaysChange(e.target.value ? parseInt(e.target.value) : null)} placeholder="30" min={1} className={INPUT_CLS} />
        </div>
      </div>

      {/* ── Columns ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Columns</p>
          <p className="text-[11px] text-gray-400">Tap a chip to show / hide</p>
        </div>

        <div className="space-y-2">
          {onShowStageChange && (
            <ColumnRow
              name="Item"
              enabled={showStage ?? true}
              onToggle={() => onShowStageChange(!(showStage ?? true))}
              label={stageLabel}
              onLabelChange={onStageLabelChange}
              labelPlaceholder="Item"
            />
          )}

          {onShowDescriptionChange && (
            <ColumnRow
              name="Description"
              enabled={showDescription ?? true}
              onToggle={() => onShowDescriptionChange(!(showDescription ?? true))}
              label={descriptionLabel}
              onLabelChange={onDescriptionLabelChange}
              labelPlaceholder="Description"
            />
          )}

          <ColumnRow
            name="Quantity"
            enabled={qtyEnabled}
            onToggle={() => onQtyEnabledChange(!qtyEnabled)}
            label={qtyLabel}
            onLabelChange={onQtyLabelChange}
            labelPlaceholder="Quantity"
          />

          {onShowRateChange && (
            <ColumnRow
              name="Unit $"
              enabled={showRate ?? true}
              onToggle={() => onShowRateChange(!(showRate ?? true))}
              label={rateLabel}
              onLabelChange={onRateLabelChange}
              labelPlaceholder="Unit $"
            />
          )}

          {onShowLineTotalChange && (
            <ColumnRow
              name="Total"
              enabled={showLineTotal ?? true}
              onToggle={() => onShowLineTotalChange(!(showLineTotal ?? true))}
              label={totalLabel}
              onLabelChange={onTotalLabelChange}
              labelPlaceholder="Total"
            />
          )}
        </div>
      </div>

      {/* ── Summary Rows ──────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Summary Rows</p>
          <p className="text-[11px] text-gray-400">Shown below the line items</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {onShowSubtotalChange && (
            <Chip enabled={showSubtotal ?? true} onClick={() => onShowSubtotalChange(!(showSubtotal ?? true))}>
              Subtotal
            </Chip>
          )}
          {onShowDiscountChange && (
            <Chip enabled={showDiscount ?? true} onClick={() => onShowDiscountChange(!(showDiscount ?? true))}>
              Discount
            </Chip>
          )}
          {onShowTotalChange && (
            <Chip enabled={showTotal ?? true} onClick={() => onShowTotalChange(!(showTotal ?? true))}>
              Grand Total
            </Chip>
          )}
        </div>
      </div>

    </div>
  );
}
