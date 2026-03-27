// components/admin/pricing/PricingTotals.tsx
'use client';

import { PricingLineItem, formatAUD, pricingSubtotal, pricingEffectiveSubtotal, pricingTotalDiscount, pricingTax } from '@/lib/supabase';

interface PricingTotalsProps {
  items: PricingLineItem[];
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
}

export default function PricingTotals({ items, taxEnabled, taxRate, taxLabel }: PricingTotalsProps) {
  const baseSubtotal = pricingSubtotal(items);
  const discount = pricingTotalDiscount(items);
  const effectiveSubtotal = pricingEffectiveSubtotal(items);
  const tax = taxEnabled ? pricingTax(effectiveSubtotal, taxRate) : 0;
  const total = effectiveSubtotal + tax;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="space-y-2 text-sm">
        {discount > 0 ? (
          <>
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="font-medium text-gray-700">{formatAUD(baseSubtotal)}</span>
            </div>
            <div className="flex justify-between text-teal">
              <span>Discount</span>
              <span className="font-medium">−{formatAUD(discount)}</span>
            </div>
            <div className="flex justify-between text-gray-500 border-t border-gray-100 pt-2">
              <span>After discount</span>
              <span className="font-medium text-gray-700">{formatAUD(effectiveSubtotal)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="font-medium text-gray-700">{formatAUD(effectiveSubtotal)}</span>
          </div>
        )}
        {taxEnabled && (
          <div className="flex justify-between text-gray-500">
            <span>{taxLabel}</span>
            <span className="font-medium text-gray-700">{formatAUD(tax)}</span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
          <span>Total</span>
          <span>{formatAUD(total)}</span>
        </div>
      </div>
    </div>
  );
}
