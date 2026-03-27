// components/admin/pricing/PricingLineItems.tsx
'use client';

import { useCallback } from 'react';
import { GripVertical, Plus, Trash2, Tag } from 'lucide-react';
import { PricingLineItem, generateItemId, pricingEffectiveSubtotal, effectiveItemAmount, formatAUD } from '@/lib/supabase';
import CurrencyInput from '@/components/ui/CurrencyInput';

interface PricingLineItemsProps {
  items: PricingLineItem[];
  onChange: (items: PricingLineItem[]) => void;
  qtyEnabled?: boolean;
  qtyLabel?: string;
  footerNote?: string;
  onFooterNoteChange?: (v: string) => void;
}

export default function PricingLineItems({ items, onChange, qtyEnabled = false, qtyLabel = 'Qty', footerNote, onFooterNoteChange }: PricingLineItemsProps) {
  const effectiveSubtotal = pricingEffectiveSubtotal(items);

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
        ...(qtyEnabled ? { qty: 1, unit_price: 0 } : {}),
      },
    ]);
  }, [items, onChange, qtyEnabled]);

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PricingLineItem, value: string | number | undefined) => {
    onChange(items.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (qtyEnabled && (field === 'qty' || field === 'unit_price')) {
        const q = field === 'qty' ? Number(value) : (item.qty ?? 1);
        const r = field === 'unit_price' ? Number(value) : (item.unit_price ?? 0);
        updated.amount = Math.round(q * r * 100) / 100;
      }
      return updated;
    }));
  };

  const recalcPercentages = useCallback(() => {
    const sub = pricingEffectiveSubtotal(items);
    if (sub === 0) return;
    onChange(
      items.map((item) => ({
        ...item,
        percentage: Math.round((effectiveItemAmount(item) / sub) * 100 * 10) / 10,
      }))
    );
  }, [items, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">Line Items</label>
        <button
          onClick={addItem}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
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
        {items.map((item, idx) => {
          const effective = effectiveItemAmount(item);
          const hasDiscount = (item.discount_pct ?? 0) > 0;
          return (
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
                    className="w-28 px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                  />
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                    placeholder="Description"
                    className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                  />
                </div>
                {qtyEnabled ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 shrink-0">{qtyLabel || 'Qty'}</span>
                      <input
                        type="number"
                        value={item.qty ?? 1}
                        onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                        onBlur={recalcPercentages}
                        min={0}
                        step="any"
                        className="w-16 px-2 py-1.5 rounded border border-gray-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal/30"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-xs text-gray-400 shrink-0">Rate</span>
                      <CurrencyInput
                        value={item.unit_price ?? 0}
                        onChange={(val) => updateItem(item.id, 'unit_price', val)}
                        onBlur={recalcPercentages}
                        size="sm"
                        className="flex-1"
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right shrink-0">
                      {effectiveSubtotal > 0 ? `${Math.round((effective / effectiveSubtotal) * 100)}%` : '—'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CurrencyInput
                      value={item.amount}
                      onChange={(val) => updateItem(item.id, 'amount', val)}
                      onBlur={recalcPercentages}
                      size="sm"
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-400 w-12 text-right">
                      {effectiveSubtotal > 0 ? `${Math.round((effective / effectiveSubtotal) * 100)}%` : '—'}
                    </span>
                  </div>
                )}
                {/* Discount row */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, 'discount_pct', hasDiscount ? 0 : 10)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      hasDiscount
                        ? 'bg-teal/10 text-teal border border-teal/20'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent'
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
                          onBlur={recalcPercentages}
                          min={0}
                          max={100}
                          step={0.5}
                          className="w-16 px-2 py-1 rounded border border-teal/20 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal/30 bg-teal/5"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        saves <span className="text-teal font-medium">{formatAUD(item.amount - effective)}</span>
                        {' '}→ <span className="font-medium text-gray-700">{formatAUD(effective)}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {onFooterNoteChange !== undefined && (
        <div className="mt-3">
          <textarea
            value={footerNote ?? ''}
            onChange={(e) => onFooterNoteChange(e.target.value)}
            rows={2}
            placeholder="Footer note — e.g. * Prices exclude travel expenses. All figures in AUD."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-500 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
          />
        </div>
      )}
    </div>
  );
}
