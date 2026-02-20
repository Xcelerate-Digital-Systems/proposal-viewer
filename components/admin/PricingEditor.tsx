// components/admin/PricingEditor.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Check, DollarSign, Eye, EyeOff, GripVertical, Loader2, Plus, Trash2, X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  PricingLineItem, PricingOptionalItem, ProposalPricing,
  formatAUD, generateItemId, pricingSubtotal, pricingTax,
} from '@/lib/supabase';

interface PricingEditorProps {
  proposalId: string;
  companyId: string;
  numPages: number;
  onSave: () => void;
  onCancel: () => void;
}

const DEFAULT_INTRO = 'The following costs are based on the agreed scope of works outlined within this proposal. All pricing has been carefully prepared to reflect the works required for successful project delivery.';

export default function PricingEditor({ proposalId, companyId, numPages, onSave, onCancel }: PricingEditorProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Pricing state
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState(-1);
  const [title, setTitle] = useState('Project Investment');
  const [introText, setIntroText] = useState(DEFAULT_INTRO);
  const [items, setItems] = useState<PricingLineItem[]>([]);
  const [optionalItems, setOptionalItems] = useState<PricingOptionalItem[]>([]);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(10);
  const [taxLabel, setTaxLabel] = useState('GST (10%)');
  const [validityDays, setValidityDays] = useState<number | null>(30);
  const [proposalDate, setProposalDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Load existing pricing data
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch(`/api/proposals/pricing?proposal_id=${proposalId}`);
        if (res.ok) {
          const data: ProposalPricing | null = await res.json();
          if (data) {
            setEnabled(data.enabled);
            setPosition(data.position);
            setTitle(data.title);
            setIntroText(data.intro_text || DEFAULT_INTRO);
            setItems(data.items || []);
            setOptionalItems(data.optional_items || []);
            setTaxEnabled(data.tax_enabled);
            setTaxRate(data.tax_rate);
            setTaxLabel(data.tax_label);
            setValidityDays(data.validity_days);
            setProposalDate(data.proposal_date || new Date().toISOString().split('T')[0]);
          }
        }
      } catch {
        // No pricing data yet — use defaults
      }
      setLoading(false);
    };
    fetchPricing();
  }, [proposalId]);

  // Add a new line item
  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: generateItemId(),
        label: '',
        description: `Stage ${String(prev.length + 1).padStart(2, '0')}`,
        percentage: 0,
        amount: 0,
        sort_order: prev.length,
      },
    ]);
  }, []);

  // Remove a line item
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update a line item field
  const updateItem = (id: string, field: keyof PricingLineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Add optional item
  const addOptionalItem = useCallback(() => {
    setOptionalItems((prev) => [
      ...prev,
      {
        id: generateItemId(),
        label: '',
        description: '',
        amount: 0,
        sort_order: prev.length,
      },
    ]);
  }, []);

  // Remove optional item
  const removeOptionalItem = (id: string) => {
    setOptionalItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update optional item
  const updateOptionalItem = (id: string, field: keyof PricingOptionalItem, value: string | number) => {
    setOptionalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Auto-calculate percentages based on amounts
  const recalcPercentages = useCallback(() => {
    const sub = pricingSubtotal(items);
    if (sub === 0) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        percentage: Math.round((item.amount / sub) * 100 * 10) / 10,
      }))
    );
  }, [items]);

  // Save pricing
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/proposals/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          enabled,
          position,
          title,
          intro_text: introText,
          items,
          optional_items: optionalItems,
          tax_enabled: taxEnabled,
          tax_rate: taxRate,
          tax_label: taxLabel,
          validity_days: validityDays,
          proposal_date: proposalDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to save pricing');
      } else {
        toast.success('Pricing saved');
        onSave();
      }
    } catch {
      toast.error('Failed to save pricing');
    }
    setSaving(false);
  };

  // Computed values
  const subtotal = pricingSubtotal(items);
  const tax = taxEnabled ? pricingTax(subtotal, taxRate) : 0;
  const total = subtotal + tax;

  if (loading) {
    return (
      <div className="border-t border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin text-[#017C87]" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-900">Pricing Page</h4>
          {/* Enable toggle */}
          <div className="flex items-center gap-2">
            {enabled ? <Eye size={14} className="text-[#017C87]" /> : <EyeOff size={14} className="text-gray-400" />}
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-[#017C87]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#017C87] text-white hover:bg-[#01434A] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project Investment"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
            />
          </div>

          {/* Intro text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Introduction Text</label>
            <textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 resize-none"
            />
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
            >
              <option value={-1}>Last page</option>
              {Array.from({ length: numPages }, (_, i) => (
                <option key={i} value={i + 1}>After page {i + 1}</option>
              ))}
              <option value={0}>First page</option>
            </select>
          </div>

          {/* Date & Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote Date</label>
              <input
                type="date"
                value={proposalDate}
                onChange={(e) => setProposalDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid For (days)</label>
              <input
                type="number"
                value={validityDays ?? ''}
                onChange={(e) => setValidityDays(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="30"
                min={1}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40"
              />
            </div>
          </div>

          {/* Tax toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-sm font-medium text-gray-700">Include GST</span>
              <p className="text-xs text-gray-400">10% Goods and Services Tax</p>
            </div>
            <button
              onClick={() => setTaxEnabled(!taxEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${taxEnabled ? 'bg-[#017C87]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${taxEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Right: Line Items */}
        <div className="space-y-4">
          {/* Line items */}
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
                          onChange={(e) => {
                            updateItem(item.id, 'amount', parseFloat(e.target.value) || 0);
                          }}
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

          {/* Optional extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Optional Extras</label>
              <button
                onClick={addOptionalItem}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
              >
                <Plus size={12} /> Add Extra
              </button>
            </div>
            <div className="space-y-2">
              {optionalItems.length === 0 && (
                <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                  Optional extras appear in a separate section below the main quote.
                </p>
              )}
              {optionalItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-3">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateOptionalItem(item.id, 'label', e.target.value)}
                    placeholder="Extra description"
                    className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#017C87]/30"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={item.amount || ''}
                      onChange={(e) => updateOptionalItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      className="w-full pl-5 pr-2 py-1.5 rounded border border-gray-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#017C87]/30"
                    />
                  </div>
                  <button
                    onClick={() => removeOptionalItem(item.id)}
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals preview */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="font-medium text-gray-700">{formatAUD(subtotal)}</span>
              </div>
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
        </div>
      </div>
    </div>
  );
}