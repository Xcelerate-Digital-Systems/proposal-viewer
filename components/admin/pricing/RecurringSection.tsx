// components/admin/pricing/RecurringSection.tsx
'use client';

import { RotateCcw } from 'lucide-react';
import { PaymentSchedule, formatAUD } from '@/lib/supabase';
import Toggle from '@/components/ui/Toggle';
import CurrencyInput from '@/components/ui/CurrencyInput';
import {
  FREQUENCY_OPTIONS, frequencyLabel,
  TEAL_BORDER, TEAL_BG, TEAL_TEXT, TEAL_FOCUS,
} from './usePricingSchedule';

interface RecurringSectionProps {
  recurring: PaymentSchedule['recurring'];
  onUpdate: (changes: Partial<PaymentSchedule['recurring']>) => void;
}

export default function RecurringSection({ recurring, onUpdate }: RecurringSectionProps) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${recurring.enabled ? `${TEAL_BORDER} ${TEAL_BG}` : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <RotateCcw size={15} className={recurring.enabled ? TEAL_TEXT : 'text-gray-400'} />
          <span className="text-sm font-medium text-gray-900">Recurring Payment</span>
        </div>
        <Toggle enabled={recurring.enabled} onChange={(v) => onUpdate({ enabled: v })} size="sm" />
      </div>
      <p className="text-[11px] text-gray-400 mb-3 ml-[23px]">
        Ongoing payment — retainer, subscription, maintenance, etc.
      </p>

      {recurring.enabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={recurring.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Ongoing Retainer"
              className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${TEAL_FOCUS} placeholder:text-gray-400`}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount ($)</label>
              <CurrencyInput value={recurring.amount} onChange={(val) => onUpdate({ amount: val })} size="md" />
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
              <select
                value={recurring.frequency}
                onChange={(e) => onUpdate({ frequency: e.target.value as PaymentSchedule['recurring']['frequency'] })}
                className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${TEAL_FOCUS}`}
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
            <input
              type="text"
              value={recurring.note}
              onChange={(e) => onUpdate({ note: e.target.value })}
              placeholder="e.g. Billed monthly after project completion"
              className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${TEAL_FOCUS} placeholder:text-gray-400`}
            />
          </div>
          {recurring.amount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#017C87]/5 text-sm">
              <span className="text-gray-500">Recurring</span>
              <span className={`font-semibold ${TEAL_TEXT}`}>
                {formatAUD(recurring.amount)}/{frequencyLabel(recurring.frequency).toLowerCase()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
