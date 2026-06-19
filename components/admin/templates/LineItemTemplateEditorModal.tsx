// components/admin/templates/LineItemTemplateEditorModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { authedFetch } from '@/lib/api-fetch';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { formatCurrency, type CurrencyCode } from '@/lib/supabase';

interface LineItem {
  id: string;
  label: string;
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
  percentage: number;
  sort_order: number;
}

interface LineItemTemplate {
  id: string;
  name: string;
  description: string | null;
  items: unknown[];
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  template: LineItemTemplate | null;
  onSaved: (saved: LineItemTemplate) => void;
  currency?: CurrencyCode;
}

function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `li_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function LineItemTemplateEditorModal({ open, onClose, template, onSaved, currency = 'AUD' }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setDescription(template.description ?? '');
      setItems(((template.items ?? []) as LineItem[]).map((it, i) => ({ ...it, sort_order: i })));
    } else {
      setName('');
      setDescription('');
      setItems([{ id: genId(), label: '', description: '', qty: 1, unit_price: 0, amount: 0, percentage: 0, sort_order: 0 }]);
    }
  }, [open, template]);

  if (!open) return null;

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const merged = { ...it, ...patch };
        merged.amount = Math.round((merged.qty ?? 1) * (merged.unit_price ?? 0) * 100) / 100;
        return merged;
      }),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: genId(), label: '', description: '', qty: 1, unit_price: 0, amount: 0, percentage: 0, sort_order: prev.length },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const subtotal = items.reduce((s, it) => s + (it.amount ?? 0), 0);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (items.length === 0) { toast.error('Add at least one line item'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        items: items.map((it, i) => ({ ...it, sort_order: i })),
      };

      const isEdit = !!template;
      const url = isEdit ? `/api/line-item-templates/${template!.id}` : '/api/line-item-templates';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await authedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');

      toast.success(isEdit ? 'Template updated' : 'Template created');
      onSaved(json.template ?? json);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge shrink-0">
          <h2 className="text-base font-semibold text-ink">
            {template ? 'Edit Line Item Template' : 'New Line Item Template'}
          </h2>
          <button onClick={onClose} className="text-faint hover:text-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bathroom Renovation Standard"
                className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
            </div>
          </div>

          {/* Line items table */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Line Items</label>
            <div className="border border-edge-strong rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1.4fr_1.4fr_64px_100px_80px_28px] gap-2 px-3 py-2 bg-surface text-detail font-medium uppercase tracking-wider text-faint border-b border-edge">
                <div>Item</div>
                <div>Description</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Unit $</div>
                <div className="text-right">Total</div>
                <div />
              </div>

              {/* Rows */}
              <div className="divide-y divide-edge">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1.4fr_1.4fr_64px_100px_80px_28px] gap-2 items-center px-3 py-2"
                  >
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateItem(item.id, { label: e.target.value })}
                      placeholder="Item name"
                      className="w-full px-2 py-1.5 rounded border border-transparent hover:border-edge-strong focus:border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-2 py-1.5 rounded border border-transparent hover:border-edge-strong focus:border-edge-strong text-sm text-dim focus:outline-none focus:ring-1 focus:ring-teal/30"
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded border border-edge-strong text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-teal/30"
                    />
                    <CurrencyInput
                      value={item.unit_price}
                      onChange={(val) => updateItem(item.id, { unit_price: val })}
                      size="sm"
                      className="w-full"
                    />
                    <div className="text-sm text-right font-medium tabular-nums text-ink px-1">
                      {formatCurrency(item.amount, currency)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length <= 1}
                      className="p-1 rounded text-faint hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-edge bg-surface">
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:bg-teal/5 px-2 py-1 rounded-lg transition-colors"
                >
                  <Plus size={12} />
                  Add Line Item
                </button>
                <span className="text-xs text-faint tabular-nums">
                  Subtotal · <span className="text-prose font-medium">{formatCurrency(subtotal, currency)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-edge shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            {template ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}
