// components/admin/pricing/PricingPaymentSchedule.tsx
'use client';

import { useState } from 'react';
import {
  Wallet, RotateCcw, Banknote, Receipt, ChevronDown, ChevronUp,
  Plus, Trash2, AlertTriangle,
} from 'lucide-react';
import {
  PaymentSchedule, MilestonePayment, PricingLineItem,
  pricingSubtotal, pricingTax, formatAUD,
  generateItemId, milestoneAmount, milestoneTotalPercent, milestoneTotalFixed,
} from '@/lib/supabase';
import Toggle from '@/components/ui/Toggle';

interface PricingPaymentScheduleProps {
  schedule: PaymentSchedule;
  items: PricingLineItem[];
  taxEnabled: boolean;
  taxRate: number;
  onChange: (schedule: PaymentSchedule) => void;
}

const FREQUENCY_OPTIONS: { value: PaymentSchedule['recurring']['frequency']; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const frequencyLabel = (f: string) => FREQUENCY_OPTIONS.find((o) => o.value === f)?.label ?? f;

export default function PricingPaymentSchedule({
  schedule,
  items,
  taxEnabled,
  taxRate,
  onChange,
}: PricingPaymentScheduleProps) {
  // Defensive: ensure all top-level keys exist even if DB returns partial/null fields
  const defaultOneOff = { enabled: false, amount: 0, label: 'One-off Payment', note: 'Due on signing' };
  const defaultMilestones = { enabled: false, payments: [] as MilestonePayment[] };
  const defaultRecurring = { enabled: false, amount: 0, frequency: 'monthly' as const, label: 'Ongoing Retainer', note: '' };

  const s: PaymentSchedule = {
    one_off: schedule?.one_off ?? defaultOneOff,
    milestones: schedule?.milestones ?? defaultMilestones,
    recurring: schedule?.recurring ?? defaultRecurring,
  };

  const [expanded, setExpanded] = useState(
    s.one_off.enabled || s.milestones.enabled || s.recurring.enabled
  );

  const subtotal = pricingSubtotal(items);
  const tax = taxEnabled ? pricingTax(subtotal, taxRate) : 0;
  const projectTotal = subtotal + tax;

  const update = (changes: Partial<PaymentSchedule>) => {
    onChange({ ...s, ...changes });
  };

  // ─── One-off handlers ──────────────────────────────────────
  const updateOneOff = (changes: Partial<PaymentSchedule['one_off']>) => {
    update({ one_off: { ...s.one_off, ...changes } });
  };

  // ─── Milestone handlers ────────────────────────────────────
  const updateMilestonePayment = (id: string, changes: Partial<MilestonePayment>) => {
    const payments = s.milestones.payments.map((p) =>
      p.id === id ? { ...p, ...changes } : p
    );
    update({ milestones: { ...s.milestones, payments } });
  };

  const addMilestone = () => {
    const payments = [
      ...s.milestones.payments,
      {
        id: `ms_${generateItemId()}`,
        label: `Payment ${s.milestones.payments.length + 1}`,
        type: 'percentage' as const,
        value: 0,
        note: '',
      },
    ];
    update({ milestones: { ...s.milestones, payments } });
  };

  const removeMilestone = (id: string) => {
    if (s.milestones.payments.length <= 2) return;
    const payments = s.milestones.payments.filter((p) => p.id !== id);
    update({ milestones: { ...s.milestones, payments } });
  };

  // ─── Recurring handlers ────────────────────────────────────
  const updateRecurring = (changes: Partial<PaymentSchedule['recurring']>) => {
    update({ recurring: { ...s.recurring, ...changes } });
  };

  // ─── Milestone validation ──────────────────────────────────
  const percentTotal = milestoneTotalPercent(s.milestones.payments);
  const fixedTotal = milestoneTotalFixed(s.milestones.payments);
  const hasAllPercentage = s.milestones.payments.every((p) => p.type === 'percentage');
  const hasAllFixed = s.milestones.payments.every((p) => p.type === 'fixed');
  const hasMixed = !hasAllPercentage && !hasAllFixed;

  let milestoneWarning = '';
  if (s.milestones.enabled) {
    if (hasAllPercentage && Math.abs(percentTotal - 100) > 0.01) {
      milestoneWarning = `Milestone percentages add up to ${percentTotal}% — should total 100%`;
    } else if (hasAllFixed && projectTotal > 0 && Math.abs(fixedTotal - projectTotal) > 0.01) {
      milestoneWarning = `Fixed amounts total ${formatAUD(fixedTotal)} but project total is ${formatAUD(projectTotal)}`;
    } else if (hasMixed) {
      const actualSum = s.milestones.payments.reduce(
        (sum, p) => sum + milestoneAmount(p, projectTotal), 0
      );
      if (projectTotal > 0 && Math.abs(actualSum - projectTotal) > 0.01) {
        milestoneWarning = `Milestone payments total ${formatAUD(actualSum)} — project total is ${formatAUD(projectTotal)}`;
      }
    }
  }

  const hasAny = s.one_off.enabled || s.milestones.enabled || s.recurring.enabled;

  // Teal shades for consistent branding
  const teal = '#017C87';
  const tealBorder = 'border-[#017C87]/30';
  const tealBg = 'bg-[#017C87]/[0.02]';
  const tealText = 'text-[#017C87]';
  const tealFocus = 'focus:ring-[#017C87]/20 focus:border-[#017C87]/40';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Wallet size={16} className={hasAny ? tealText : 'text-gray-400'} />
          <span className="text-sm font-semibold text-gray-900">Payment Schedule</span>
          {hasAny && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#017C87]/10 text-[#017C87] font-medium">
              Active
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <p className="text-xs text-gray-400">
            Define how your client pays. Enable any combination — or leave all off for just line items and a total.
          </p>

          {/* ─── One-off Payment ───────────────────────────────────── */}
          <div className={`rounded-lg border p-4 transition-colors ${s.one_off.enabled ? `${tealBorder} ${tealBg}` : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Receipt size={15} className={s.one_off.enabled ? tealText : 'text-gray-400'} />
                <span className="text-sm font-medium text-gray-900">One-off Payment</span>
              </div>
              <Toggle
                enabled={s.one_off.enabled}
                onChange={(v) => updateOneOff({ enabled: v })}
                size="sm"
              />
            </div>
            <p className="text-[11px] text-gray-400 mb-3 ml-[23px]">
              A standalone payment — setup fee, onboarding charge, etc.
            </p>

            {s.one_off.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                  <input
                    type="text"
                    value={s.one_off.label}
                    onChange={(e) => updateOneOff({ label: e.target.value })}
                    placeholder="e.g. Setup Fee, Onboarding"
                    className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus} placeholder:text-gray-400`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={s.one_off.amount}
                      onChange={(e) => updateOneOff({ amount: parseFloat(e.target.value) || 0 })}
                      className={`w-full pl-8 pr-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
                  <input
                    type="text"
                    value={s.one_off.note}
                    onChange={(e) => updateOneOff({ note: e.target.value })}
                    placeholder="e.g. Due on signing"
                    className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus} placeholder:text-gray-400`}
                  />
                </div>
                {s.one_off.amount > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#017C87]/5 text-sm">
                    <span className="text-gray-500">{s.one_off.label}</span>
                    <span className={`font-semibold ${tealText}`}>{formatAUD(s.one_off.amount)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Milestone Payments ────────────────────────────────── */}
          <div className={`rounded-lg border p-4 transition-colors ${s.milestones.enabled ? `${tealBorder} ${tealBg}` : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Banknote size={15} className={s.milestones.enabled ? tealText : 'text-gray-400'} />
                <span className="text-sm font-medium text-gray-900">Milestone Payments</span>
              </div>
              <Toggle
                enabled={s.milestones.enabled}
                onChange={(v) => update({ milestones: { ...s.milestones, enabled: v } })}
                size="sm"
              />
            </div>
            <p className="text-[11px] text-gray-400 mb-3 ml-[23px]">
              Split the project total into multiple payments — deposit, progress payments, final payment
            </p>

            {s.milestones.enabled && (
              <div className="space-y-3">
                {/* Milestone list */}
                {s.milestones.payments.map((payment, idx) => {
                  const amt = milestoneAmount(payment, projectTotal);
                  return (
                    <div
                      key={payment.id}
                      className="rounded-md border border-[#017C87]/15 bg-white p-3 space-y-2.5"
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${tealText} w-5 shrink-0 text-center`}>
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={payment.label}
                          onChange={(e) => updateMilestonePayment(payment.id, { label: e.target.value })}
                          placeholder={`Payment ${idx + 1}`}
                          className={`flex-1 px-2.5 py-1.5 rounded border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus} placeholder:text-gray-400`}
                        />
                        {s.milestones.payments.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeMilestone(payment.id)}
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
                          onChange={(e) => updateMilestonePayment(payment.id, { type: e.target.value as 'percentage' | 'fixed' })}
                          className={`w-32 px-2 py-1.5 rounded border border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 ${tealFocus}`}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                            {payment.type === 'percentage' ? '%' : '$'}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={payment.type === 'percentage' ? 100 : undefined}
                            step={payment.type === 'percentage' ? 5 : 0.01}
                            value={payment.value}
                            onChange={(e) => updateMilestonePayment(payment.id, { value: parseFloat(e.target.value) || 0 })}
                            className={`w-full pl-7 pr-2.5 py-1.5 rounded border border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 ${tealFocus}`}
                          />
                        </div>
                        {projectTotal > 0 && (
                          <span className={`text-xs font-medium ${tealText} shrink-0 w-24 text-right`}>
                            {formatAUD(amt)}
                          </span>
                        )}
                      </div>

                      {/* Note */}
                      <div className="ml-7">
                        <input
                          type="text"
                          value={payment.note}
                          onChange={(e) => updateMilestonePayment(payment.id, { note: e.target.value })}
                          placeholder="e.g. Due on signing"
                          className={`w-full px-2.5 py-1.5 rounded border border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 ${tealFocus} placeholder:text-gray-400`}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Add milestone button */}
                <button
                  type="button"
                  onClick={addMilestone}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-[#017C87]/30 ${tealText} text-xs font-medium hover:bg-[#017C87]/[0.03] transition-colors`}
                >
                  <Plus size={14} />
                  Add Payment
                </button>

                {/* Warning if totals don't match */}
                {milestoneWarning && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-orange-50 text-xs text-orange-700">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>{milestoneWarning}</span>
                  </div>
                )}

                {/* Visual progress bar */}
                {projectTotal > 0 && (
                  <div>
                    <div className="flex rounded-full h-3 overflow-hidden bg-gray-100">
                      {s.milestones.payments.map((payment, idx) => {
                        const amt = milestoneAmount(payment, projectTotal);
                        const pct = Math.min(100, (amt / projectTotal) * 100);
                        // Teal gradient from dark to light across payments
                        const opacity = 1 - (idx / Math.max(1, s.milestones.payments.length - 1)) * 0.5;
                        return (
                          <div
                            key={payment.id}
                            className="transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: teal,
                              opacity,
                              borderRight: idx < s.milestones.payments.length - 1 ? '1px solid rgba(255,255,255,0.5)' : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1 text-[11px] text-gray-400">
                      <span>{s.milestones.payments[0]?.label}</span>
                      <span>{s.milestones.payments[s.milestones.payments.length - 1]?.label}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Recurring ─────────────────────────────────────────── */}
          <div className={`rounded-lg border p-4 transition-colors ${s.recurring.enabled ? `${tealBorder} ${tealBg}` : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <RotateCcw size={15} className={s.recurring.enabled ? tealText : 'text-gray-400'} />
                <span className="text-sm font-medium text-gray-900">Recurring Payment</span>
              </div>
              <Toggle
                enabled={s.recurring.enabled}
                onChange={(v) => updateRecurring({ enabled: v })}
                size="sm"
              />
            </div>
            <p className="text-[11px] text-gray-400 mb-3 ml-[23px]">
              Ongoing payment — retainer, subscription, maintenance, etc.
            </p>

            {s.recurring.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                  <input
                    type="text"
                    value={s.recurring.label}
                    onChange={(e) => updateRecurring({ label: e.target.value })}
                    placeholder="Ongoing Retainer"
                    className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus} placeholder:text-gray-400`}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={s.recurring.amount}
                        onChange={(e) => updateRecurring({ amount: parseFloat(e.target.value) || 0 })}
                        className={`w-full pl-8 pr-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus}`}
                      />
                    </div>
                  </div>
                  <div className="w-44">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                    <select
                      value={s.recurring.frequency}
                      onChange={(e) =>
                        updateRecurring({ frequency: e.target.value as PaymentSchedule['recurring']['frequency'] })
                      }
                      className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus}`}
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
                    value={s.recurring.note}
                    onChange={(e) => updateRecurring({ note: e.target.value })}
                    placeholder="e.g. Billed monthly after project completion"
                    className={`w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 ${tealFocus} placeholder:text-gray-400`}
                  />
                </div>
                {s.recurring.amount > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#017C87]/5 text-sm">
                    <span className="text-gray-500">Recurring</span>
                    <span className={`font-semibold ${tealText}`}>
                      {formatAUD(s.recurring.amount)}/{frequencyLabel(s.recurring.frequency).toLowerCase()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Payment Summary ───────────────────────────────────── */}
          {hasAny && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Client will see
              </h5>
              <div className="space-y-2 text-sm">
                {s.one_off.enabled && s.one_off.amount > 0 && (
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#017C87]" />
                      <div>
                        <span className="text-gray-700">{s.one_off.label}</span>
                        {s.one_off.note && (
                          <span className="text-xs text-gray-400 ml-1.5">— {s.one_off.note}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-gray-900">{formatAUD(s.one_off.amount)}</span>
                  </div>
                )}
                {s.milestones.enabled && s.milestones.payments.map((payment, idx) => {
                  const amt = milestoneAmount(payment, projectTotal);
                  const opacity = 1 - (idx / Math.max(1, s.milestones.payments.length - 1)) * 0.4;
                  return (
                    <div key={payment.id} className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: teal, opacity }}
                        />
                        <div>
                          <span className="text-gray-700">{payment.label}</span>
                          {payment.note && (
                            <span className="text-xs text-gray-400 ml-1.5">— {payment.note}</span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">{formatAUD(amt)}</span>
                    </div>
                  );
                })}
                {s.recurring.enabled && s.recurring.amount > 0 && (
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#017C87]" />
                      <div>
                        <span className="text-gray-700">{s.recurring.label}</span>
                        {s.recurring.note && (
                          <span className="text-xs text-gray-400 ml-1.5">— {s.recurring.note}</span>
                        )}
                      </div>
                    </div>
                    <span className={`font-semibold ${tealText}`}>
                      {formatAUD(s.recurring.amount)}/{frequencyLabel(s.recurring.frequency).toLowerCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}