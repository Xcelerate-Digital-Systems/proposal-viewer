// components/admin/quotes/sections/QuoteLineItemsSection.tsx
// Lean line items table matching QuoteWin: Item | Description | Qty | Unit $
// | Total. No column toggles, no stage label, no validity-days knob, no
// optional items, no payment schedule. Quote-level pricing settings (GST,
// deposit) live in PricingSettingsSection; line-item templates live in the
// header bar via LineItemsLibraryBar.
'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const prevSaveStatus = useRef(editor.saveStatus);
  useEffect(() => {
    if (prevSaveStatus.current === 'saving' && editor.saveStatus === 'saved') {
      onApplied();
    }
    prevSaveStatus.current = editor.saveStatus;
  }, [editor.saveStatus, onApplied]);

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

  const tableRef = useRef<HTMLDivElement>(null);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key !== 'Enter') return;
      const isLast = index === items.length - 1;
      if (!isLast) return;
      e.preventDefault();
      addItem();
      requestAnimationFrame(() => {
        const rows = tableRef.current?.querySelectorAll('[role="row"]');
        const lastRow = rows?.[rows.length - 1];
        const firstInput = lastRow?.querySelector('input');
        firstInput?.focus();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length],
  );

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
      {/* Table */}
      <div role="table" aria-label="Line items" ref={tableRef}>
        <div role="rowgroup">
          <div role="row" className="grid grid-cols-[1.4fr_1.6fr_72px_120px_88px_28px] gap-2 px-2 pb-2 border-b border-edge text-detail font-medium uppercase tracking-wider text-faint">
            <div role="columnheader">Item</div>
            <div role="columnheader">Description</div>
            <div role="columnheader" className="text-right">Qty</div>
            <div role="columnheader" className="text-right">Unit $</div>
            <div role="columnheader" className="text-right">Total</div>
            <div role="columnheader"><span className="sr-only">Actions</span></div>
          </div>
        </div>

        <div role="rowgroup" className="divide-y divide-edge">
          {items.length === 0 && (
            <div role="row" className="py-6 text-center text-xs text-faint">
              <div role="cell">No line items yet. Click <span className="text-teal font-medium">Add Line Item</span> to start.</div>
            </div>
          )}
          {items.map((item, idx) => (
            <div
              key={item.id}
              role="row"
              className="grid grid-cols-[1.4fr_1.6fr_72px_120px_88px_28px] gap-2 items-center px-2 py-2"
              onKeyDown={(e) => handleRowKeyDown(e, idx)}
            >
            <div role="cell">
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                placeholder="Item name"
                aria-label="Item name"
                className="w-full px-2 py-1.5 rounded border border-transparent hover:border-edge-strong focus:border-edge-strong focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
            </div>
            <div role="cell">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                placeholder="Optional"
                aria-label="Description"
                className="w-full px-2 py-1.5 rounded border border-transparent hover:border-edge-strong focus:border-edge-strong focus:bg-white text-sm text-dim focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
            </div>
            <div role="cell">
              <input
                type="number"
                min={0}
                step="any"
                value={item.qty ?? 1}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  updateItem(item.id, { qty: Number.isFinite(v) && v >= 0 ? v : 0 });
                }}
                aria-label="Quantity"
                className="w-full px-2 py-1.5 rounded border border-edge-strong text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
            </div>
            <div role="cell">
              <CurrencyInput
                value={item.unit_price ?? 0}
                onChange={(val) => updateItem(item.id, { unit_price: val })}
                size="sm"
                className="w-full"
              />
            </div>
            <div role="cell" className="text-sm text-right font-medium tabular-nums text-ink px-2">
              {formatAUD(item.amount)}
            </div>
            <div role="cell">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => removeItem(item.id)}
                className="p-1 rounded text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label={`Remove ${item.label || 'line item'}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Footer: Add Line Item + running subtotal */}
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
          Subtotal · <span className="text-prose font-medium">{formatAUD(subtotal)}</span>
        </div>
      </div>
    </SectionCard>
  );
}
