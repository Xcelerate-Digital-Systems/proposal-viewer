// components/admin/pricing/PricingSettings.tsx
'use client';

import Toggle from '@/components/ui/Toggle';

const INPUT_CLS = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40';

interface PricingSettingsProps {
  title: string;
  introText: string;
  taxEnabled: boolean;
  validityDays: number | null;
  proposalDate: string | null;
  qtyEnabled: boolean;
  qtyLabel: string;
  onTitleChange: (v: string) => void;
  onIntroTextChange: (v: string) => void;
  onTaxEnabledChange: (v: boolean) => void;
  onValidityDaysChange: (v: number | null) => void;
  onProposalDateChange: (v: string) => void;
  onQtyEnabledChange: (v: boolean) => void;
  onQtyLabelChange: (v: string) => void;
}

export default function PricingSettings({
  title, introText, taxEnabled, validityDays, proposalDate, qtyEnabled, qtyLabel,
  onTitleChange, onIntroTextChange, onTaxEnabledChange, onValidityDaysChange, onProposalDateChange,
  onQtyEnabledChange, onQtyLabelChange,
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

      {/* Tax toggle */}
      <div className="flex items-center justify-between py-2 border-t border-gray-100">
        <div>
          <span className="text-sm font-medium text-gray-700">Include GST</span>
          <p className="text-xs text-gray-400">10% Goods and Services Tax</p>
        </div>
        <Toggle enabled={taxEnabled} onChange={onTaxEnabledChange} size="sm" />
      </div>

      {/* Qty toggle */}
      <div className="flex items-center justify-between py-2 border-t border-gray-100">
        <div>
          <span className="text-sm font-medium text-gray-700">Show Quantities</span>
          <p className="text-xs text-gray-400">Add Qty × Rate columns to line items</p>
        </div>
        <Toggle enabled={qtyEnabled} onChange={onQtyEnabledChange} size="sm" />
      </div>

      {/* Qty label — shown when qty is enabled */}
      {qtyEnabled && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Label</label>
          <input
            type="text"
            value={qtyLabel}
            onChange={(e) => onQtyLabelChange(e.target.value)}
            placeholder="Qty"
            className={INPUT_CLS}
          />
          <p className="text-xs text-gray-400 mt-1">Column header label — e.g. "Qty", "Hours", "Days", "Units"</p>
        </div>
      )}
    </div>
  );
}
