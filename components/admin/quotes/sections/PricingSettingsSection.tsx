// components/admin/quotes/sections/PricingSettingsSection.tsx
// GST + Deposit toggles, modelled on the QuoteWin layout. Stores the four
// columns directly on proposals so the viewer can read them flat — old quotes
// that still keep these settings inside pricing.payload remain compatible:
// the viewer prefers proposals.* when non-null, otherwise falls back to the
// pricing-page payload.
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { supabase, type Proposal, formatCurrency, pricingEffectiveSubtotal, SUPPORTED_CURRENCIES, type CurrencyCode } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/components/ui/Toast';
import Toggle from '@/components/ui/Toggle';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
  refreshKey?: number;
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm font-medium text-prose">
      <Toggle enabled={checked} onChange={onChange} size="sm" />
      <span>{label}</span>
    </div>
  );
}

export default function PricingSettingsSection({ proposal, onSaved, refreshKey = 0 }: Props) {
  const toast = useToast();
  const [currency, setCurrency] = useState<CurrencyCode>((proposal as Record<string, unknown>).currency as CurrencyCode || 'AUD');
  const [includeGst, setIncludeGst] = useState(proposal.include_gst ?? true);
  const [gstRate, setGstRate] = useState(proposal.gst_rate ?? 0.10);
  const [requireDeposit, setRequireDeposit] = useState(proposal.require_deposit ?? true);
  const [depositPercent, setDepositPercent] = useState(proposal.deposit_percent ?? 30);
  const [subtotal, setSubtotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const fmt = (amount: number) => formatCurrency(amount, currency);

  // Load the current pricing page's line items to compute the live summary.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await authFetch(`/api/proposals/pages?proposal_id=${proposal.id}`);
      if (!res.ok) return;
      const json = await res.json();
      const pages = (json.pages ?? json) as Array<Record<string, unknown>>;
      const pricingPage = pages.find((p) => p.type === 'pricing');
      const items = (pricingPage?.payload as Record<string, unknown> | undefined)?.items as
        | Parameters<typeof pricingEffectiveSubtotal>[0]
        | undefined;
      if (!cancelled) setSubtotal(pricingEffectiveSubtotal(items ?? []));
    })();
    return () => {
      cancelled = true;
    };
  }, [proposal.id, proposal.updated_at, refreshKey]);

  const gstAmount = includeGst ? Math.round(subtotal * gstRate * 100) / 100 : 0;
  const total = subtotal + gstAmount;
  const depositAmount = requireDeposit
    ? Math.round(total * (depositPercent / 100) * 100) / 100
    : 0;

  const dirty =
    currency !== ((proposal as Record<string, unknown>).currency as CurrencyCode || 'AUD') ||
    includeGst !== (proposal.include_gst ?? true) ||
    gstRate !== (proposal.gst_rate ?? 0.10) ||
    requireDeposit !== (proposal.require_deposit ?? true) ||
    depositPercent !== (proposal.deposit_percent ?? 30);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('proposals')
      .update({
        currency,
        include_gst: includeGst,
        gst_rate: gstRate,
        require_deposit: requireDeposit,
        deposit_percent: depositPercent,
      })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) toast.error('Failed to save pricing settings');
    else {
      toast.success('Pricing settings saved');
      onSaved();
    }
  };

  const gstPct = Math.round(gstRate * 100);

  return (
    <SectionCard title="Tax & Deposit">
      <div className="space-y-4">
        {/* Currency */}
        <div>
          <label className="block text-xs font-medium text-prose mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value as CurrencyCode);
              setTimeout(() => save(), 0);
            }}
            className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 bg-white"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.symbol} — {c.label} ({c.code})</option>
            ))}
          </select>
        </div>

        {/* GST */}
        <div>
          <ToggleRow
            checked={includeGst}
            onChange={(v) => {
              setIncludeGst(v);
              // auto-save on toggle so it feels snappy
              setTimeout(() => save(), 0);
            }}
            label={`Include GST (${gstPct}%)`}
          />

          {/* Summary table */}
          <div className="mt-3 rounded-lg bg-surface px-4 py-3 text-sm space-y-1.5">
            <div className="flex items-center justify-between text-dim">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            {includeGst && (
              <div className="flex items-center justify-between text-dim">
                <span>GST ({gstPct}%)</span>
                <span className="tabular-nums">{fmt(gstAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-edge-strong font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums text-teal">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Deposit */}
        <div className="pt-4 border-t border-edge">
          <ToggleRow
            checked={requireDeposit}
            onChange={(v) => {
              setRequireDeposit(v);
              setTimeout(() => save(), 0);
            }}
            label="Require Deposit"
          />

          {requireDeposit && (
            <div className="mt-3 flex items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-prose mb-1">
                  Deposit %
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={depositPercent}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setDepositPercent(Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);
                  }}
                  onBlur={() => dirty && save()}
                  className="w-24 px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
              </div>
              <div className="text-sm text-dim pt-6 tabular-nums">
                = <span className="font-semibold text-ink">{fmt(depositAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {dirty && (
          <div className="flex items-center justify-end pt-3 border-t border-edge">
            <Button
              size="sm"
              loading={saving}
              onClick={save}
            >
              Save Pricing Settings
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
