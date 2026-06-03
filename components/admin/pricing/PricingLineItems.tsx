// components/admin/pricing/PricingLineItems.tsx
// Tabular line-item editor matching the Quote builder's QuoteLineItemsSection
// pattern: header row + grid rows with hover-bordered inputs. The proposal
// flow keeps its extra features (Stage column, optional Qty × Rate columns,
// per-item discount, % share) but lays them out in the same lean grid as
// Quote so the two tools stay visually consistent.
'use client';

import { useCallback } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
import {
  PricingLineItem, generateItemId, pricingEffectiveSubtotal,
  effectiveItemAmount, formatCurrency, type CurrencyCode,
} from '@/lib/supabase';
import CurrencyInput from '@/components/ui/CurrencyInput';

interface PricingLineItemsProps {
  items: PricingLineItem[];
  onChange: (items: PricingLineItem[]) => void;
  currency?: CurrencyCode;
  qtyEnabled?: boolean;
  qtyLabel?: string;
  stageLabel?: string;
  descriptionLabel?: string;
  rateLabel?: string;
  footerNote?: string;
  onFooterNoteChange?: (v: string) => void;
}

const CELL_INPUT =
  'w-full px-2 py-1.5 rounded border border-transparent hover:border-edge-strong focus:border-edge-strong focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-teal/30';

const NUM_INPUT =
  'w-full px-2 py-1.5 rounded border border-edge-strong text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-teal/30';

export default function PricingLineItems({
  items, onChange,
  currency = 'AUD',
  qtyEnabled = false, qtyLabel = 'Quantity',
  stageLabel = 'Item', descriptionLabel = 'Description', rateLabel,
  footerNote, onFooterNoteChange,
}: PricingLineItemsProps) {
  const subtotal = pricingEffectiveSubtotal(items);

  const addItem = useCallback(() => {
    onChange([
      ...items,
      {
        id: generateItemId(),
        label: '',
        description: `${stageLabel} ${String(items.length + 1).padStart(2, '0')}`,
        percentage: 0,
        amount: 0,
        sort_order: items.length,
        ...(qtyEnabled ? { qty: 1, unit_price: 0 } : {}),
      },
    ]);
  }, [items, onChange, qtyEnabled, stageLabel]);

  const removeItem = (id: string) =>
    onChange(items.filter((item) => item.id !== id));

  const updateItem = (id: string, patch: Partial<PricingLineItem>) => {
    onChange(items.map((it) => {
      if (it.id !== id) return it;
      const merged: PricingLineItem = { ...it, ...patch };
      if (qtyEnabled) {
        const q = Number(merged.qty ?? 1);
        const u = Number(merged.unit_price ?? 0);
        merged.amount = Math.round(q * u * 100) / 100;
      }
      return merged;
    }));
  };

  const recalcPercentages = useCallback(() => {
    const sub = pricingEffectiveSubtotal(items);
    if (sub === 0) return;
    onChange(items.map((item) => ({
      ...item,
      percentage: Math.round((effectiveItemAmount(item) / sub) * 100 * 10) / 10,
    })));
  }, [items, onChange]);

  // Grid template — Stage | Description | (Qty | Rate)? | Total | % | delete
  const gridCols = qtyEnabled
    ? 'grid-cols-[1.2fr_1.6fr_72px_120px_96px_48px_28px]'
    : 'grid-cols-[1.2fr_1.6fr_120px_48px_28px]';

  return (
    <div>
      {/* Header row */}
      <div className={`grid ${gridCols} gap-2 px-2 pb-2 border-b border-edge text-detail font-medium uppercase tracking-wider text-faint`}>
        <div>{stageLabel || 'Item'}</div>
        <div>{descriptionLabel || 'Description'}</div>
        {qtyEnabled && <div className="text-right">{qtyLabel || 'Quantity'}</div>}
        {qtyEnabled && <div className="text-right">{rateLabel || 'Unit $'}</div>}
        <div className="text-right">Total</div>
        <div className="text-right">%</div>
        <div />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-faint">
            No line items yet — click <span className="text-teal font-medium">Add Line Item</span> to start.
          </div>
        )}

        {items.map((item, idx) => {
          const effective = effectiveItemAmount(item);
          const hasDiscount = (item.discount_pct ?? 0) > 0;
          const pct = subtotal > 0
            ? `${Math.round((effective / subtotal) * 100)}%`
            : '—';

          return (
            <div key={item.id}>
              <div className={`grid ${gridCols} gap-2 items-center px-2 py-2`}>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder={`${stageLabel} ${String(idx + 1).padStart(2, '0')}`}
                  className={CELL_INPUT}
                />
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.id, { label: e.target.value })}
                  placeholder={descriptionLabel}
                  className={`${CELL_INPUT} text-dim`}
                />

                {qtyEnabled && (
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={item.qty ?? 1}
                    onChange={(e) => updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })}
                    onBlur={recalcPercentages}
                    className={NUM_INPUT}
                  />
                )}
                {qtyEnabled && (
                  <CurrencyInput
                    value={item.unit_price ?? 0}
                    onChange={(val) => updateItem(item.id, { unit_price: val })}
                    onBlur={recalcPercentages}
                    size="sm"
                    className="w-full"
                  />
                )}

                {qtyEnabled ? (
                  <div className="text-sm text-right font-medium tabular-nums text-ink px-2">
                    {formatCurrency(item.amount, currency)}
                  </div>
                ) : (
                  <CurrencyInput
                    value={item.amount}
                    onChange={(val) => updateItem(item.id, { amount: val })}
                    onBlur={recalcPercentages}
                    size="sm"
                    className="w-full"
                  />
                )}

                <div className="text-xs text-faint text-right tabular-nums">{pct}</div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove line"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Discount row — hidden until the user opts in */}
              <div className="px-2 pb-2 -mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateItem(item.id, { discount_pct: hasDiscount ? 0 : 10 })}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-detail font-medium transition-colors ${
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
                        onChange={(e) => updateItem(item.id, { discount_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                        onBlur={recalcPercentages}
                        min={0}
                        max={100}
                        step={0.5}
                        className="w-14 px-1.5 py-0.5 rounded border border-teal/20 text-detail text-right focus:outline-none focus:ring-1 focus:ring-teal/30 bg-teal/5"
                      />
                      <span className="text-detail text-faint">%</span>
                    </div>
                    <span className="text-detail text-faint">
                      saves <span className="text-teal font-medium">{formatCurrency(item.amount - effective, currency)}</span>
                      {' '}→ <span className="font-medium text-prose">{formatCurrency(effective, currency)}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-edge">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
        >
          <Plus size={12} />
          Add Line Item
        </button>

        <div className="ml-auto text-xs text-faint tabular-nums">
          Subtotal · <span className="text-prose font-medium">{formatCurrency(subtotal, currency)}</span>
        </div>
      </div>

      {onFooterNoteChange !== undefined && (
        <div className="mt-3">
          <textarea
            value={footerNote ?? ''}
            onChange={(e) => onFooterNoteChange(e.target.value)}
            rows={2}
            placeholder="Footer note — e.g. * Prices exclude travel expenses. All figures in AUD."
            className="w-full px-3 py-2 rounded-lg border border-edge-strong bg-white text-xs text-dim placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-teal/30 resize-none"
          />
        </div>
      )}
    </div>
  );
}
