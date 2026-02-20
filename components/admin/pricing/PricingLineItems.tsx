// components/admin/pricing/PricingLineItems.tsx
'use client';

import { useCallback } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { PricingLineItem, generateItemId, pricingSubtotal } from '@/lib/supabase';

interface PricingLineItemsProps {
  items: PricingLineItem[];
  onChange: (items: PricingLineItem[]) => void;
}

export default function PricingLineItems({ items, onChange }: PricingLineItemsProps) {
  const subtotal = pricingSubtotal(items);

  const addItem = useCallback(() => {
    onChange([
      ...items,
      {
        id: generateItemId(),
        label: '',
        description: `Stage ${String(items.length + 1).padStart(2, '0')}`,
        percentage: 0,
        amount: 0,
        sort_order: items.length,
      },
    ]);
  }, [items, onChange]);

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PricingLineItem, value: string | number) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const recalcPercentages = useCallback(() => {
    const sub = pricingSubtotal(items);
    if (sub === 0) return;
    onChange(
      items.map((item) => ({
        ...item,
        percentage: Math.round((item.amount / sub) * 100 * 10) / 10,
      }))
    );
  }, [items, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Line Items</label>
        <button
          onClick={addItem}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
        >
          <Plus size={12} /> Add Item
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
            No line items yet. Click &quot;Add Item&quot; to start.
          </p>
        )}
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-2 bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center pt-2 text-gray-300">
              <GripVertical size={14} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder={`Stage ${String(idx + 1).padStart(2, '0')}`}
                  className="w-24 px-2 py-1.5 rounded border border-gray-200 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#017C87]/30"
                />
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                  placeholder="Description"
                  className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#017C87]/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input
                    type="number"
                    value={item.amount || ''}
                    onChange={(e) => updateItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                    onBlur={recalcPercentages}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    className="w-full pl-5 pr-2 py-1.5 rounded border border-gray-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#017C87]/30"
                  />
                </div>
                <span className="text-xs text-gray-400 w-12 text-right">
                  {subtotal > 0 ? `${Math.round((item.amount / subtotal) * 100)}%` : '—'}
                </span>
              </div>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-1"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}