// components/admin/quotes/sections/QuoteLineItemsSection.tsx
// Lean line items table matching QuoteWin: Item | Description | Qty | Unit $
// | Total. No column toggles, no stage label, no validity-days knob, no
// optional items, no payment schedule. Quote-level pricing settings (GST,
// deposit) live in PricingSettingsSection; full-quote templates load through
// LoadTemplateBar in the footer; line-item templates live in the header bar.
'use client';

import { useEffect, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  type Proposal,
  type PricingLineItem,
  formatAUD,
  generateItemId,
  pricingEffectiveSubtotal,
} from '@/lib/supabase';
import { usePricingEditor } from '@/components/admin/shared/usePricingEditor';
import { useReportSaveStatus } from '@/components/admin/EditorSaveStatusContext';
import CurrencyInput from '@/components/ui/CurrencyInput';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';
import LineItemsLibraryBar from '@/components/admin/proposals/quote-builder/LineItemsLibraryBar';
import LoadTemplateBar from '@/components/admin/proposals/quote-builder/LoadTemplateBar';

interface Props {
  proposal: Proposal;
  companyId: string;
  onApplied: () => void;
}

export default function QuoteLineItemsSection({ proposal, companyId, onApplied }: Props) {
  const editor = usePricingEditor({
    apiBase: '/api/proposals/pages',
    entityKey: 'proposal_id',
    entityId: proposal.id,
    companyId: null,
  });
  useReportSaveStatus(editor.saveStatus);

  // Quotes always use quantity-based pricing — there's no UI to turn it off.
  // Snap the underlying flag once the pricing page is loaded so rows saved
  // from the legacy builder pick up the new shape.
  useEffect(() => {
    if (editor.loaded && editor.selectedId && !editor.form.qtyEnabled) {
      editor.updateForm({ qtyEnabled: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.loaded, editor.selectedId]);

  // Auto-create a pricing page on first mount if the quote has none, so the
  // table is editable immediately rather than requiring a manual "add page".
  useEffect(() => {
    if (editor.loaded && !editor.selectedId && !editor.adding) {
      editor.addPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.loaded, editor.selectedId]);

  const items = editor.form.items;
  const subtotal = useMemo(() => pricingEffectiveSubtotal(items), [items]);

  const updateItem = (id: string, patch: Partial<PricingLineItem>) => {
    const next = items.map((it) => {
      if (it.id !== id) return it;
      const merged: PricingLineItem = { ...it, ...patch };
      const q = Number(merged.qty ?? 1);
      const u = Number(merged.unit_price ?? 0);
      merged.amount = Math.round(q * u * 100) / 100;
      return merged;
    });
    editor.updateForm({ items: next });
  };

  const addItem = () => {
    editor.updateForm({
      items: [
        ...items,
        {
          id: generateItemId(),
          label: '',
          description: '',
          percentage: 0,
          amount: 0,
          qty: 1,
          unit_price: 0,
          sort_order: items.length,
        },
      ],
    });
  };

  const removeItem = (id: string) => {
    editor.updateForm({ items: items.filter((it) => it.id !== id) });
  };

  return (
    <SectionCard
      title="Line Items"
      action={
        <LineItemsLibraryBar
          items={items}
          replaceItems={(next) => editor.updateForm({ items: next })}
        />
      }
    >
      {/* Table head */}
      <div className="grid grid-cols-[1.4fr_1.6fr_72px_120px_88px_28px] gap-2 px-2 pb-2 border-b border-gray-100 text-[11px] font-medium uppercase tracking-wider text-gray-400">
        <div>Item</div>
        <div>Description</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Unit $</div>
        <div className="text-right">Total</div>
        <div />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-gray-400">
            No line items yet — click <span className="text-teal font-medium">Add Line Item</span> to start.
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1.4fr_1.6fr_72px_120px_88px_28px] gap-2 items-center px-2 py-2"
          >
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateItem(item.id, { label: e.target.value })}
              placeholder="Item name"
              className="w-full px-2 py-1.5 rounded border border-transparent hover:border-gray-200 focus:border-gray-200 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              placeholder="Optional"
              className="w-full px-2 py-1.5 rounded border border-transparent hover:border-gray-200 focus:border-gray-200 focus:bg-white text-sm text-gray-500 focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
            <input
              type="number"
              min={0}
              step="any"
              value={item.qty ?? 1}
              onChange={(e) => updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-teal/30"
            />
            <CurrencyInput
              value={item.unit_price ?? 0}
              onChange={(val) => updateItem(item.id, { unit_price: val })}
              size="sm"
              className="w-full"
            />
            <div className="text-sm text-right font-medium tabular-nums text-gray-900 px-2">
              {formatAUD(item.amount)}
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remove line"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer: Add Line Item + Load Template (full-quote) + running subtotal */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
        >
          <Plus size={12} />
          Add Line Item
        </button>

        <LoadTemplateBar proposal={proposal} companyId={companyId} onApplied={onApplied} />

        <div className="ml-auto text-xs text-gray-400 tabular-nums">
          Subtotal · <span className="text-gray-700 font-medium">{formatAUD(subtotal)}</span>
        </div>
      </div>
    </SectionCard>
  );
}
