// components/admin/pricing/MilestonesSection.tsx
'use client';

import { Banknote, Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  PaymentSchedule, MilestonePayment, formatAUD, milestoneAmount,
} from '@/lib/supabase';
import Toggle from '@/components/ui/Toggle';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { TEAL, TEAL_BORDER, TEAL_BG, TEAL_TEXT, TEAL_FOCUS } from './usePricingSchedule';

interface MilestonesSectionProps {
  milestones: PaymentSchedule['milestones'];
  projectTotal: number;
  milestoneWarning: string;
  onEnable: (v: boolean) => void;
  onUpdatePayment: (id: string, changes: Partial<MilestonePayment>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function MilestonesSection({
  milestones, projectTotal, milestoneWarning,
  onEnable, onUpdatePayment, onAdd, onRemove,
}: MilestonesSectionProps) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${milestones.enabled ? `${TEAL_BORDER} ${TEAL_BG}` : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Banknote size={15} className={milestones.enabled ? TEAL_TEXT : 'text-gray-400'} />
          <span className="text-sm font-medium text-gray-900">Milestone Payments</span>
        </div>
        <Toggle enabled={milestones.enabled} onChange={onEnable} size="sm" />
      </div>
      <p className="text-[11px] text-gray-400 mb-3 ml-[23px]">
        Split the project total into multiple payments — deposit, progress payments, final payment
      </p>

      {milestones.enabled && (
        <div className="space-y-3">
          {milestones.payments.map((payment, idx) => {
            const amt = milestoneAmount(payment, projectTotal);
            return (
              <div key={payment.id} className="rounded-md border border-teal/15 bg-white p-3 space-y-2.5">
                {/* Header row */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${TEAL_TEXT} w-5 shrink-0 text-center`}>{idx + 1}</span>
                  <input
                    type="text"
                    value={payment.label}
                    onChange={(e) => onUpdatePayment(payment.id, { label: e.target.value })}
                    placeholder={`Payment ${idx + 1}`}
                    className={`flex-1 px-2.5 py-1.5 rounded border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${TEAL_FOCUS} placeholder:text-gray-400`}
                  />
                  {milestones.payments.length > 2 && (
                    <button
                      type="button"
                      onClick={() => onRemove(payment.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                      title="Remove payment"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Type + value row */}
                <div className="flex items-center gap-2 ml-7">
                  <select
                    value={payment.type}
                    onChange={(e) => onUpdatePayment(payment.id, { type: e.target.value as 'percentage' | 'fixed' })}
                    className={`w-32 px-2 py-1.5 rounded border border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 ${TEAL_FOCUS}`}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                  <div className="relative flex-1">
                    <CurrencyInput
                      value={payment.value}
                      onChange={(val) => onUpdatePayment(payment.id, { value: val })}
                      prefix={payment.type === 'percentage' ? '%' : '$'}
                      size="sm"
                    />
                  </div>
                  {projectTotal > 0 && (
                    <span className={`text-xs font-medium ${TEAL_TEXT} shrink-0 w-24 text-right`}>
                      {formatAUD(amt)}
                    </span>
                  )}
                </div>

                {/* Note */}
                <div className="ml-7">
                  <input
                    type="text"
                    value={payment.note}
                    onChange={(e) => onUpdatePayment(payment.id, { note: e.target.value })}
                    placeholder="e.g. Due on signing"
                    className={`w-full px-2.5 py-1.5 rounded border border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 ${TEAL_FOCUS} placeholder:text-gray-400`}
                  />
                </div>
              </div>
            );
          })}

          {/* Add milestone button */}
          <button
            type="button"
            onClick={onAdd}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-teal/30 ${TEAL_TEXT} text-xs font-medium hover:bg-teal/[0.03] transition-colors`}
          >
            <Plus size={14} />
            Add Payment
          </button>

          {/* Warning */}
          {milestoneWarning && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-orange-50 text-xs text-orange-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{milestoneWarning}</span>
            </div>
          )}

          {/* Progress bar */}
          {projectTotal > 0 && (
            <div>
              <div className="flex rounded-full h-3 overflow-hidden bg-gray-100">
                {milestones.payments.map((payment, idx) => {
                  const amt = milestoneAmount(payment, projectTotal);
                  const pct = Math.min(100, (amt / projectTotal) * 100);
                  const opacity = 1 - (idx / Math.max(1, milestones.payments.length - 1)) * 0.5;
                  return (
                    <div
                      key={payment.id}
                      className="transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: TEAL,
                        opacity,
                        borderRight: idx < milestones.payments.length - 1 ? '1px solid rgba(255,255,255,0.5)' : undefined,
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[11px] text-gray-400">
                <span>{milestones.payments[0]?.label}</span>
                <span>{milestones.payments[milestones.payments.length - 1]?.label}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
