// components/admin/pricing/PricingOptionalItems.tsx
'use client';

import { useCallback } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
import { PricingOptionalItem, generateItemId, effectiveItemAmount, formatAUD } from '@/lib/supabase';
import CurrencyInput from '@/components/ui/CurrencyInput';

interface PricingOptionalItemsProps {
  items: PricingOptionalItem[];
  onChange: (items: PricingOptionalItem[]) => void;
}

export default function PricingOptionalItems({ items, onChange }: PricingOptionalItemsProps) {
  const addItem = useCallback(() => {
    onChange([
      ...items,
      {
        id: generateItemId(),
        label: '',
        description: '',
        amount: 0,
        sort_order: items.length,
      },
    ]);
  }, [items, onChange]);

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PricingOptionalItem, value: string | number | undefined) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-prose">Optional Extras</label>
        <button
          onClick={addItem}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
        >
          <Plus size={12} /> Add Extra
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-faint py-3 text-center border border-dashed border-edge-strong rounded-lg">
            Optional extras appear in a separate section below the main quote.
          </p>
        )}
        {items.map((item) => {
          const effective = effectiveItemAmount(item);
          const hasDiscount = (item.discount_pct ?? 0) > 0;
          return (
            <div key={item.id} className="flex flex-col gap-2 bg-white rounded-lg border border-edge-strong p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                  placeholder="Extra description"
                  className="flex-1 px-2 py-1.5 rounded border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
                <CurrencyInput
                  value={item.amount}
                  onChange={(val) => updateItem(item.id, 'amount', val)}
                  size="sm"
                  className="w-28"
                />
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {/* Discount row */}
              <div className="flex items-center gap-2 pl-0.5">
                <button
                  type="button"
                  onClick={() => updateItem(item.id, 'discount_pct', hasDiscount ? 0 : 10)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    hasDiscount
                      ? 'bg-teal/10 text-teal border border-teal/20'
                      : 'text-faint hover:text-prose hover:bg-surface border border-transparent'
                  }`}
                >
                  <Tag size={10} />
                  {hasDiscount ? `${item.discount_pct}% off` : 'Add discount'}
                </button>
                {hasDiscount && (
                  <>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={item.discount_pct ?? 0}
                        onChange={(e) => updateItem(item.id, 'discount_pct', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                        min={0}
                        max={100}
                        step={0.5}
                        className="w-16 px-2 py-1 rounded border border-teal/20 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal/30 bg-teal/5"
                      />
                      <span className="text-xs text-faint">%</span>
                    </div>
                    <span className="text-xs text-faint">
                      saves <span className="text-teal font-medium">{formatAUD(item.amount - effective)}</span>
                      {' '}→ <span className="font-medium text-prose">{formatAUD(effective)}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
