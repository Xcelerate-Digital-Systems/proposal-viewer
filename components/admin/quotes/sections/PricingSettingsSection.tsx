// components/admin/quotes/sections/PricingSettingsSection.tsx
// GST + Deposit toggles, modelled on the QuoteWin layout. Stores the four
// columns directly on proposals so the viewer can read them flat — old quotes
// that still keep these settings inside pricing.payload remain compatible:
// the viewer prefers proposals.* when non-null, otherwise falls back to the
// pricing-page payload.
'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, type Proposal, formatAUD, pricingEffectiveSubtotal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '@/components/admin/proposals/quote-builder/SectionCard';

interface Props {
  proposal: Proposal;
  onSaved: () => void;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-sm font-medium text-gray-700"
    >
      <span
        className={`w-9 h-5 rounded-full relative transition-colors ${
          checked ? 'bg-blue-500' : 'bg-gray-200'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export default function PricingSettingsSection({ proposal, onSaved }: Props) {
  const toast = useToast();
  const [includeGst, setIncludeGst] = useState(proposal.include_gst ?? true);
  const [gstRate, setGstRate] = useState(proposal.gst_rate ?? 0.10);
  const [requireDeposit, setRequireDeposit] = useState(proposal.require_deposit ?? true);
  const [depositPercent, setDepositPercent] = useState(proposal.deposit_percent ?? 30);
  const [subtotal, setSubtotal] = useState(0);
  const [saving, setSaving] = useState(false);

  // Load the current pricing page's line items to compute the live summary.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/proposals/pages?proposal_id=${proposal.id}`);
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
  }, [proposal.id, proposal.updated_at]);

  const gstAmount = includeGst ? Math.round(subtotal * gstRate * 100) / 100 : 0;
  const total = subtotal + gstAmount;
  const depositAmount = requireDeposit
    ? Math.round(total * (depositPercent / 100) * 100) / 100
    : 0;

  const dirty =
    includeGst !== (proposal.include_gst ?? true) ||
    gstRate !== (proposal.gst_rate ?? 0.10) ||
    requireDeposit !== (proposal.require_deposit ?? true) ||
    depositPercent !== (proposal.deposit_percent ?? 30);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('proposals')
      .update({
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
    <SectionCard title="Pricing">
      <div className="space-y-4">
        {/* GST */}
        <div>
          <ToggleSwitch
            checked={includeGst}
            onChange={(v) => {
              setIncludeGst(v);
              // auto-save on toggle so it feels snappy
              setTimeout(() => save(), 0);
            }}
            label={`Include GST (${gstPct}%)`}
          />

          {/* Summary table */}
          <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm space-y-1.5">
            <div className="flex items-center justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatAUD(subtotal)}</span>
            </div>
            {includeGst && (
              <div className="flex items-center justify-between text-gray-500">
                <span>GST ({gstPct}%)</span>
                <span className="tabular-nums">{formatAUD(gstAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-200 font-semibold text-gray-900">
              <span>Total</span>
              <span className="tabular-nums text-teal">{formatAUD(total)}</span>
            </div>
          </div>
        </div>

        {/* Deposit */}
        <div className="pt-4 border-t border-gray-100">
          <ToggleSwitch
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
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Deposit %
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(Number(e.target.value) || 0)}
                  onBlur={() => dirty && save()}
                  className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
              </div>
              <div className="text-sm text-gray-500 pt-6 tabular-nums">
                = <span className="font-semibold text-gray-900">{formatAUD(depositAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {dirty && (
          <div className="flex items-center justify-end pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Pricing Settings'}
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
