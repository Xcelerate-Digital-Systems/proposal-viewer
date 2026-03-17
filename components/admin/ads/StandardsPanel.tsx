// components/admin/ads/StandardsPanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdAccountStandards, TrackerStandards } from '@/lib/types/ads';

type Props = {
  trackerId: string;
  companyId: string;
  trackerStandards: TrackerStandards;
  onClose: () => void;
  onSaveTracker: (standards: TrackerStandards) => Promise<void>;
};

export default function StandardsPanel({
  trackerId,
  companyId,
  trackerStandards,
  onClose,
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

    // Save account standards
    await fetch('/api/ads/standards', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_id: companyId,
        hook_rate_target: accountStandards.hook_rate_target,
        hold_rate_target: accountStandards.hold_rate_target,
        uctr_target: accountStandards.uctr_target,
      }),
    });

    // Save campaign standards via tracker update
    await onSaveTracker(campaignStandards);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
              <Target size={16} className="text-teal" />
            </div>
            <h2 className="text-base font-semibold text-ink">Performance Standards</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="text-teal animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Universal Standards */}
            <div>
              <h3 className="text-[13px] font-semibold text-ink mb-1">Universal Standards</h3>
              <p className="text-[12px] text-faint mb-3">
                Account-level benchmarks applied to all campaigns. Metric cells will turn green when meeting or exceeding these targets, red when below.
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
            <div>
              <h3 className="text-[13px] font-semibold text-ink mb-1">Campaign Standards</h3>
              <p className="text-[12px] text-faint mb-3">
                Per-campaign cost target. Choose your metric label (CPL, CPA, ROAS, etc.) and set the target value.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-[100px] shrink-0">
                    <input
                      type="text"
                      value={campaignStandards.metric_label || ''}
                      onChange={(e) => setCampaignStandards({ ...campaignStandards, metric_label: e.target.value })}
                      placeholder="CPL"
                      className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30"
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
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-muted hover:text-ink rounded-lg hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Standards
          </button>
        </div>
      </div>
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
          className={`w-full py-2 bg-surface border border-edge rounded-lg text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${prefix ? 'pl-7 pr-3' : 'px-3'} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span>
        )}
      </div>
    </div>
  );
}
