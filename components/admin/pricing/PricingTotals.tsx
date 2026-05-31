// components/admin/pricing/PricingTotals.tsx
'use client';

import { PricingLineItem, formatCurrency, pricingSubtotal, pricingEffectiveSubtotal, pricingTotalDiscount, pricingTax, type CurrencyCode } from '@/lib/supabase';

interface PricingTotalsProps {
  items: PricingLineItem[];
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  currency?: CurrencyCode;
}

export default function PricingTotals({ items, taxEnabled, taxRate, taxLabel, currency = 'AUD' }: PricingTotalsProps) {
  const baseSubtotal = pricingSubtotal(items);
  const discount = pricingTotalDiscount(items);
  const effectiveSubtotal = pricingEffectiveSubtotal(items);
  const tax = taxEnabled ? pricingTax(effectiveSubtotal, taxRate) : 0;
  const total = effectiveSubtotal + tax;

  return (
    <div className="bg-white rounded-lg border border-edge-strong p-4">
      <div className="space-y-2 text-sm">
        {discount > 0 ? (
          <>
            <div className="flex justify-between text-dim">
              <span>Subtotal</span>
              <span className="font-medium text-prose">{formatCurrency(baseSubtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-teal">
              <span>Discount</span>
              <span className="font-medium">−{formatCurrency(discount, currency)}</span>
            </div>
            <div className="flex justify-between text-dim border-t border-edge pt-2">
              <span>After discount</span>
              <span className="font-medium text-prose">{formatCurrency(effectiveSubtotal, currency)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-dim">
            <span>Subtotal</span>
            <span className="font-medium text-prose">{formatCurrency(effectiveSubtotal, currency)}</span>
          </div>
        )}
        {taxEnabled && (
          <div className="flex justify-between text-dim">
            <span>{taxLabel}</span>
            <span className="font-medium text-prose">{formatCurrency(tax, currency)}</span>
          </div>
        )}
        <div className="border-t border-edge pt-2 flex justify-between font-semibold text-ink">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
