// components/admin/ads/StandardsTab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdAccountStandards, TrackerStandards } from '@/lib/types/ads';

type Props = {
  trackerId: string;
  companyId: string;
  trackerStandards: TrackerStandards;
  onSaveTracker: (standards: TrackerStandards) => Promise<void>;
};

export default function StandardsTab({
  trackerId,
  companyId,
  trackerStandards,
  onSaveTracker,
}: Props) {
  const [accountStandards, setAccountStandards] = useState<Partial<AdAccountStandards>>({
    hook_rate_target: null,
    hold_rate_target: null,
    uctr_target: null,
  });
  const [campaignStandards, setCampaignStandards] = useState<TrackerStandards>(trackerStandards);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchAccountStandards = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    const res = await fetch(`/api/ads/standards?company_id=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) setAccountStandards(json.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchAccountStandards();
  }, [fetchAccountStandards]);

  const handleSave = async () => {
    setSaving(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setSaving(false); return; }

    await fetch('/api/ads/standards', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        hook_rate_target: accountStandards.hook_rate_target,
        hold_rate_target: accountStandards.hold_rate_target,
        uctr_target: accountStandards.uctr_target,
      }),
    });

    await onSaveTracker(campaignStandards);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="text-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-base font-semibold text-ink mb-1">Campaign Setup</h2>
      <p className="text-[12px] text-faint mb-6">
        Performance benchmarks for this campaign. Configure your audience (target markets and personas) in the Audience panel.
      </p>

      {/* Universal Standards */}
      <div className="mb-6">
        <h3 className="text-[13px] font-semibold text-ink mb-1">Universal Standards</h3>
        <p className="text-[12px] text-faint mb-3">
          Account-level benchmarks applied to all campaigns.
        </p>
        <div className="space-y-3">
          <StandardInput
            label="Hook Rate"
            suffix="%"
            value={accountStandards.hook_rate_target}
            onChange={(v) => setAccountStandards({ ...accountStandards, hook_rate_target: v })}
            placeholder="e.g. 30"
          />
          <StandardInput
            label="Hold Rate"
            suffix="%"
            value={accountStandards.hold_rate_target}
            onChange={(v) => setAccountStandards({ ...accountStandards, hold_rate_target: v })}
            placeholder="e.g. 10"
          />
          <StandardInput
            label="UCTR"
            value={accountStandards.uctr_target}
            onChange={(v) => setAccountStandards({ ...accountStandards, uctr_target: v })}
            placeholder="e.g. 1.25"
          />
        </div>
      </div>

      {/* Campaign Standards */}
      <div className="mb-6">
        <h3 className="text-[13px] font-semibold text-ink mb-1">Campaign Standards</h3>
        <p className="text-[12px] text-faint mb-3">
          Per-campaign cost target. Choose your metric label (CPL, CPA, ROAS, etc.) and set the target value.
        </p>
        <div className="flex items-center gap-3">
          <div className="w-[100px] shrink-0">
            <input
              type="text"
              value={campaignStandards.metric_label || ''}
              onChange={(e) => setCampaignStandards({ ...campaignStandards, metric_label: e.target.value })}
              placeholder="CPL"
              className="w-full px-3 py-2 bg-surface border border-gray-100 rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 /30"
            />
          </div>
          <div className="flex-1">
            <StandardInput
              label=""
              prefix="$"
              value={campaignStandards.cpl_target}
              onChange={(v) => setCampaignStandards({ ...campaignStandards, cpl_target: v })}
              placeholder="e.g. 25.00"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saved ? 'Saved!' : 'Save Standards'}
      </button>
    </div>
  );
}

function StandardInput({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {label && (
        <label className="text-[13px] text-muted w-[80px] shrink-0">{label}</label>
      )}
      <div className="flex-1 relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{prefix}</span>
        )}
        <input
          type="number"
          step="any"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          placeholder={placeholder}
          className={`w-full py-2 bg-surface border border-gray-100 rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 /30 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${prefix ? 'pl-7 pr-3' : 'px-3'} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span>
        )}
      </div>
    </div>
  );
}
