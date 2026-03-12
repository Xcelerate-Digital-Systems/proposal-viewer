// components/admin/pricing/OneOffSection.tsx
'use client';

import { Receipt } from 'lucide-react';
import { PaymentSchedule, formatAUD } from '@/lib/supabase';
import Toggle from '@/components/ui/Toggle';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { TEAL_BORDER, TEAL_BG, TEAL_TEXT, TEAL_FOCUS } from './usePricingSchedule';

interface OneOffSectionProps {
  oneOff: PaymentSchedule['one_off'];
  onUpdate: (changes: Partial<PaymentSchedule['one_off']>) => void;
}

export default function OneOffSection({ oneOff, onUpdate }: OneOffSectionProps) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${oneOff.enabled ? `${TEAL_BORDER} ${TEAL_BG}` : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Receipt size={15} className={oneOff.enabled ? TEAL_TEXT : 'text-gray-400'} />
          <span className="text-sm font-medium text-gray-900">One-off Payment</span>
        </div>
        <Toggle enabled={oneOff.enabled} onChange={(v) => onUpdate({ enabled: v })} size="sm" />
      </div>
      <p className="text-[11px] text-gray-400 mb-3 ml-[23px]">
        A standalone payment — setup fee, onboarding charge, etc.
      </p>

      {oneOff.enabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={oneOff.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="e.g. Setup Fee, Onboarding"
              className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${TEAL_FOCUS} placeholder:text-gray-400`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount ($)</label>
            <CurrencyInput value={oneOff.amount} onChange={(val) => onUpdate({ amount: val })} size="md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
            <input
              type="text"
              value={oneOff.note}
              onChange={(e) => onUpdate({ note: e.target.value })}
              placeholder="e.g. Due on signing"
              className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${TEAL_FOCUS} placeholder:text-gray-400`}
            />
          </div>
          {oneOff.amount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-teal/5 text-sm">
              <span className="text-gray-500">{oneOff.label}</span>
              <span className={`font-semibold ${TEAL_TEXT}`}>{formatAUD(oneOff.amount)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
