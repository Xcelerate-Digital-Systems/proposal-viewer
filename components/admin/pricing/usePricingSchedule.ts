// components/admin/pricing/usePricingSchedule.ts
import { useState } from 'react';
import {
  PaymentSchedule, MilestonePayment, PricingLineItem,
  pricingSubtotal, pricingTax, formatAUD,
  generateItemId, milestoneAmount, milestoneTotalPercent, milestoneTotalFixed,
} from '@/lib/supabase';

export const FREQUENCY_OPTIONS: { value: PaymentSchedule['recurring']['frequency']; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export const frequencyLabel = (f: string) =>
  FREQUENCY_OPTIONS.find((o) => o.value === f)?.label ?? f;

// Teal shades used across all sub-components
export const TEAL = '#017C87';
export const TEAL_BORDER = 'border-[#017C87]/30';
export const TEAL_BG = 'bg-[#017C87]/[0.02]';
export const TEAL_TEXT = 'text-[#017C87]';
export const TEAL_FOCUS = 'focus:ring-[#017C87]/20 focus:border-[#017C87]/40';

export function usePricingSchedule(
  schedule: PaymentSchedule,
  items: PricingLineItem[],
  taxEnabled: boolean,
  taxRate: number,
  onChange: (schedule: PaymentSchedule) => void,
) {
  // Defensive defaults
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

  // One-off
  const updateOneOff = (changes: Partial<PaymentSchedule['one_off']>) => {
    update({ one_off: { ...s.one_off, ...changes } });
  };

  // Milestones
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

  const enableMilestones = (v: boolean) => {
    update({ milestones: { ...s.milestones, enabled: v } });
  };

  // Recurring
  const updateRecurring = (changes: Partial<PaymentSchedule['recurring']>) => {
    update({ recurring: { ...s.recurring, ...changes } });
  };

  // Milestone validation
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

  return {
    s,
    expanded, setExpanded,
    projectTotal,
    hasAny,
    // One-off
    updateOneOff,
    // Milestones
    updateMilestonePayment, addMilestone, removeMilestone, enableMilestones,
    milestoneWarning,
    // Recurring
    updateRecurring,
  };
}
