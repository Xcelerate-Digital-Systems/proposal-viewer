// components/admin/pricing/PricingSettings.tsx
'use client';

import Toggle from '@/components/ui/Toggle';

const INPUT_CLS = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40';
const LABEL_INPUT_CLS = 'mt-1.5 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal/30';

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
  totalLabel?: string;
  showTotals?: boolean;
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
  onTotalLabelChange?: (v: string) => void;
  onShowTotalsChange?: (v: boolean) => void;
}

export default function PricingSettings({
  title, introText, taxEnabled, validityDays, proposalDate, qtyEnabled, qtyLabel,
  showStage, stageLabel, showDescription, descriptionLabel, showRate, rateLabel, totalLabel, showTotals,
  onTitleChange, onIntroTextChange, onTaxEnabledChange, onValidityDaysChange, onProposalDateChange,
  onQtyEnabledChange, onQtyLabelChange, onShowStageChange, onStageLabelChange,
  onShowDescriptionChange, onDescriptionLabelChange,
  onShowRateChange, onRateLabelChange, onTotalLabelChange, onShowTotalsChange,
}: PricingSettingsProps) {
  return (
    <div className="space-y-4">
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

      {/* ── Column & Display Toggles ──────────────────────────────── */}
      <div className="border-t border-gray-100 pt-3 space-y-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Columns & Display</p>

        {/* Stage toggle + label */}
        {onShowStageChange && (
          <div className="py-2 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Stage</span>
              <Toggle enabled={showStage ?? true} onChange={onShowStageChange} size="sm" />
            </div>
            {(showStage ?? true) && onStageLabelChange && (
              <input
                type="text"
                value={stageLabel ?? 'Stage'}
                onChange={(e) => onStageLabelChange(e.target.value)}
                placeholder="Stage"
                className={LABEL_INPUT_CLS}
              />
            )}
          </div>
        )}

        {/* Description toggle + label */}
        {onShowDescriptionChange && (
          <div className="py-2 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Description</span>
              <Toggle enabled={showDescription ?? true} onChange={onShowDescriptionChange} size="sm" />
            </div>
            {(showDescription ?? true) && onDescriptionLabelChange && (
              <input
                type="text"
                value={descriptionLabel ?? ''}
                onChange={(e) => onDescriptionLabelChange(e.target.value)}
                placeholder="Description"
                className={LABEL_INPUT_CLS}
              />
            )}
          </div>
        )}

        {/* Qty toggle + label */}
        <div className="py-2 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Quantities</span>
              <p className="text-xs text-gray-400">Qty × Rate columns</p>
            </div>
            <Toggle enabled={qtyEnabled} onChange={onQtyEnabledChange} size="sm" />
          </div>
          {qtyEnabled && (
            <input
              type="text"
              value={qtyLabel}
              onChange={(e) => onQtyLabelChange(e.target.value)}
              placeholder="Qty"
              className={LABEL_INPUT_CLS}
            />
          )}
        </div>

        {/* Rate/Amount toggle + label */}
        {onShowRateChange && (
          <div className="py-2 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{qtyEnabled ? 'Rate' : 'Amount'}</span>
              <Toggle enabled={showRate ?? true} onChange={onShowRateChange} size="sm" />
            </div>
            {(showRate ?? true) && onRateLabelChange && (
              <input
                type="text"
                value={rateLabel ?? ''}
                onChange={(e) => onRateLabelChange(e.target.value)}
                placeholder={qtyEnabled ? 'Rate' : 'Amount'}
                className={LABEL_INPUT_CLS}
              />
            )}
          </div>
        )}

        {/* Tax toggle */}
        <div className="flex items-center justify-between py-2 border-b border-gray-50">
          <div>
            <span className="text-sm font-medium text-gray-700">Include GST</span>
            <p className="text-xs text-gray-400">10% Goods and Services Tax</p>
          </div>
          <Toggle enabled={taxEnabled} onChange={onTaxEnabledChange} size="sm" />
        </div>

        {/* Totals toggle + label */}
        {onShowTotalsChange && (
          <div className="py-2 border-b border-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Totals</span>
                <p className="text-xs text-gray-400">Subtotal, discount, and total rows</p>
              </div>
              <Toggle enabled={showTotals ?? true} onChange={onShowTotalsChange} size="sm" />
            </div>
            {(showTotals ?? true) && onTotalLabelChange && (
              <input
                type="text"
                value={totalLabel ?? ''}
                onChange={(e) => onTotalLabelChange(e.target.value)}
                placeholder="Total"
                className={LABEL_INPUT_CLS}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
