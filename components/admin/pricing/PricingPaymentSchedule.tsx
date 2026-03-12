// components/admin/pricing/PricingPaymentSchedule.tsx
'use client';

import { Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { PaymentSchedule, PricingLineItem } from '@/lib/supabase';
import { usePricingSchedule, TEAL_TEXT } from './usePricingSchedule';
import OneOffSection from './OneOffSection';
import MilestonesSection from './MilestonesSection';
import RecurringSection from './RecurringSection';
import PaymentSummary from './PaymentSummary';

interface PricingPaymentScheduleProps {
  schedule: PaymentSchedule;
  items: PricingLineItem[];
  taxEnabled: boolean;
  taxRate: number;
  onChange: (schedule: PaymentSchedule) => void;
}

export default function PricingPaymentSchedule({
  schedule, items, taxEnabled, taxRate, onChange,
}: PricingPaymentScheduleProps) {
  const h = usePricingSchedule(schedule, items, taxEnabled, taxRate, onChange);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => h.setExpanded(!h.expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Wallet size={16} className={h.hasAny ? TEAL_TEXT : 'text-gray-400'} />
          <span className="text-sm font-semibold text-gray-900">Payment Schedule</span>
          {h.hasAny && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal/10 text-teal font-medium">
              Active
            </span>
          )}
        </div>
        {h.expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {h.expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <p className="text-xs text-gray-400">
            Define how your client pays. Enable any combination — or leave all off for just line items and a total.
          </p>

          <OneOffSection oneOff={h.s.one_off} onUpdate={h.updateOneOff} />

          <MilestonesSection
            milestones={h.s.milestones}
            projectTotal={h.projectTotal}
            milestoneWarning={h.milestoneWarning}
            onEnable={h.enableMilestones}
            onUpdatePayment={h.updateMilestonePayment}
            onAdd={h.addMilestone}
            onRemove={h.removeMilestone}
          />

          <RecurringSection recurring={h.s.recurring} onUpdate={h.updateRecurring} />

          {h.hasAny && <PaymentSummary schedule={h.s} projectTotal={h.projectTotal} />}
        </div>
      )}
    </div>
  );
}
