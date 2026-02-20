// components/admin/page-editor/PricingPanel.tsx
'use client';

import { Check, DollarSign, Loader2, Trash2 } from 'lucide-react';
import { PricingFormState } from './pageEditorTypes';
import PricingSettings from '../pricing/PricingSettings';
import PricingLineItems from '../pricing/PricingLineItems';
import PricingOptionalItems from '../pricing/PricingOptionalItems';
import PricingTotals from '../pricing/PricingTotals';

interface PricingPanelProps {
  pricingForm: PricingFormState;
  pricingSaveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (changes: Partial<PricingFormState>) => void;
  onRemove: () => void;
}

export default function PricingPanel({
  pricingForm,
  pricingSaveStatus,
  onUpdate,
  onRemove,
}: PricingPanelProps) {
  return (
    <div className="flex-1 flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-white min-h-0">
      <div className="shrink-0 px-3 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
          <DollarSign size={12} className="text-[#017C87]" />
          Pricing Page
        </span>
        <div className="flex items-center gap-2">
          {pricingSaveStatus === 'saving' && <Loader2 size={12} className="animate-spin text-gray-300" />}
          {pricingSaveStatus === 'saved' && <Check size={13} className="text-emerald-400" />}
          <button
            onClick={onRemove}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={11} />
            Remove
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
        <PricingSettings
          title={pricingForm.title}
          introText={pricingForm.introText}
          taxEnabled={pricingForm.taxEnabled}
          validityDays={pricingForm.validityDays}
          proposalDate={pricingForm.proposalDate}
          onTitleChange={(v) => onUpdate({ title: v })}
          onIntroTextChange={(v) => onUpdate({ introText: v })}
          onTaxEnabledChange={(v) => onUpdate({ taxEnabled: v })}
          onValidityDaysChange={(v) => onUpdate({ validityDays: v })}
          onProposalDateChange={(v) => onUpdate({ proposalDate: v })}
        />
        <PricingLineItems
          items={pricingForm.items}
          onChange={(items) => onUpdate({ items })}
        />
        <PricingOptionalItems
          items={pricingForm.optionalItems}
          onChange={(optionalItems) => onUpdate({ optionalItems })}
        />
        <PricingTotals
          items={pricingForm.items}
          taxEnabled={pricingForm.taxEnabled}
          taxRate={pricingForm.taxRate}
          taxLabel={pricingForm.taxLabel}
        />
      </div>
    </div>
  );
}