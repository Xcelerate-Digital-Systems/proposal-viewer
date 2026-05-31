// components/admin/pricing/PaymentSummary.tsx
'use client';

import { PaymentSchedule, formatCurrency, type CurrencyCode, milestoneAmount } from '@/lib/supabase';
import { TEAL, TEAL_TEXT, frequencyLabel } from './usePricingSchedule';

interface PaymentSummaryProps {
  schedule: PaymentSchedule;
  projectTotal: number;
  currency?: CurrencyCode;
}

export default function PaymentSummary({ schedule, projectTotal, currency = 'AUD' }: PaymentSummaryProps) {
  const { one_off, milestones, recurring } = schedule;

  return (
    <div className="rounded-lg border border-edge-strong p-4">
      <h5 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3">
        Client will see
      </h5>
      <div className="space-y-2 text-sm">
        {one_off.enabled && one_off.amount > 0 && (
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal" />
              <div>
                <span className="text-prose">{one_off.label}</span>
                {one_off.note && (
                  <span className="text-xs text-faint ml-1.5">— {one_off.note}</span>
                )}
              </div>
            </div>
            <span className="font-semibold text-ink">{formatCurrency(one_off.amount, currency)}</span>
          </div>
        )}
        {milestones.enabled && milestones.payments.map((payment, idx) => {
          const amt = milestoneAmount(payment, projectTotal);
          const opacity = 1 - (idx / Math.max(1, milestones.payments.length - 1)) * 0.4;
          return (
            <div key={payment.id} className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: TEAL, opacity }}
                />
                <div>
                  <span className="text-prose">{payment.label}</span>
                  {payment.note && (
                    <span className="text-xs text-faint ml-1.5">— {payment.note}</span>
                  )}
                </div>
              </div>
              <span className="font-semibold text-ink">{formatCurrency(amt, currency)}</span>
            </div>
          );
        })}
        {recurring.enabled && recurring.amount > 0 && (
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal" />
              <div>
                <span className="text-prose">{recurring.label}</span>
                {recurring.note && (
                  <span className="text-xs text-faint ml-1.5">— {recurring.note}</span>
                )}
              </div>
            </div>
            <span className={`font-semibold ${TEAL_TEXT}`}>
              {formatCurrency(recurring.amount, currency)}/{frequencyLabel(recurring.frequency).toLowerCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
