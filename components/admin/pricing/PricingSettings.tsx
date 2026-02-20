// components/admin/pricing/PricingSettings.tsx
'use client';

interface PricingSettingsProps {
  title: string;
  introText: string;
  taxEnabled: boolean;
  validityDays: number | null;
  proposalDate: string;
  onTitleChange: (v: string) => void;
  onIntroTextChange: (v: string) => void;
  onTaxEnabledChange: (v: boolean) => void;
  onValidityDaysChange: (v: number | null) => void;
  onProposalDateChange: (v: string) => void;
}

export default function PricingSettings({
  title, introText, taxEnabled, validityDays, proposalDate,
  onTitleChange, onIntroTextChange, onTaxEnabledChange, onValidityDaysChange, onProposalDateChange,
}: PricingSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Project Investment"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
        />
      </div>

      {/* Intro text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Introduction Text</label>
        <textarea
          value={introText}
          onChange={(e) => onIntroTextChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 resize-none"
        />
      </div>

      {/* Date & Validity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quote Date</label>
          <input
            type="date"
            value={proposalDate}
            onChange={(e) => onProposalDateChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valid For (days)</label>
          <input
            type="number"
            value={validityDays ?? ''}
            onChange={(e) => onValidityDaysChange(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="30"
            min={1}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
          />
        </div>
      </div>

      {/* Tax toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <span className="text-sm font-medium text-gray-700">Include GST</span>
          <p className="text-xs text-gray-400">10% Goods and Services Tax</p>
        </div>
        <button
          onClick={() => onTaxEnabledChange(!taxEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${taxEnabled ? 'bg-[#017C87]' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${taxEnabled ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );
}