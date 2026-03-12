// components/admin/pricing/PricingOptionalItems.tsx
'use client';

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PricingOptionalItem, generateItemId } from '@/lib/supabase';
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

  const updateItem = (id: string, field: keyof PricingOptionalItem, value: string | number) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Optional Extras</label>
        <button
          onClick={addItem}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
        >
          <Plus size={12} /> Add Extra
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
            Optional extras appear in a separate section below the main quote.
          </p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-3">
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateItem(item.id, 'label', e.target.value)}
              placeholder="Extra description"
              className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
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
        ))}
      </div>
    </div>
  );
}