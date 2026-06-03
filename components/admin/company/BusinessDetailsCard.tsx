// components/admin/company/BusinessDetailsCard.tsx
// Phone / Email / ABN / Address + quote-number prefix & pad width. These
// values appear on every rendered quote (footer ABN, cover phone/email) and
// drive the quote-number format (e.g. "Q-001" → "QW-2025-0001"). Saves
// directly via the existing /api/company PATCH endpoint.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Building2 } from 'lucide-react';
import { formatQuoteNumber } from '@/lib/quote-number';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
  };
}

interface Props {
  companyId: string;
  isOwner: boolean;
}

interface FormState {
  phone: string;
  contact_email: string;
  abn: string;
  address: string;
  quote_number_prefix: string;
  quote_number_pad_width: number;
}

const DEFAULT_FORM: FormState = {
  phone: '',
  contact_email: '',
  abn: '',
  address: '',
  quote_number_prefix: 'Q-',
  quote_number_pad_width: 3,
};

export default function BusinessDetailsCard({ companyId, isOwner }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [initial, setInitial] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const fetchCompany = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    const loaded: FormState = {
      phone: d.phone ?? '',
      contact_email: d.contact_email ?? '',
      abn: d.abn ?? '',
      address: d.address ?? '',
      quote_number_prefix: d.quote_number_prefix ?? 'Q-',
      quote_number_pad_width: d.quote_number_pad_width ?? 3,
    };
    setForm(loaded);
    setInitial(loaded);
  }, [companyId]);

  useEffect(() => {
    if (companyId) fetchCompany();
  }, [companyId, fetchCompany]);

  const dirty =
    form.phone !== initial.phone ||
    form.contact_email !== initial.contact_email ||
    form.abn !== initial.abn ||
    form.address !== initial.address ||
    form.quote_number_prefix !== initial.quote_number_prefix ||
    form.quote_number_pad_width !== initial.quote_number_pad_width;

  const save = async () => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          phone: form.phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          abn: form.abn.trim() || null,
          address: form.address.trim() || null,
          quote_number_prefix: form.quote_number_prefix || 'Q-',
          quote_number_pad_width: Math.max(1, Math.min(8, Number(form.quote_number_pad_width) || 3)),
        }),
      });
      if (res.ok) {
        setInitial(form);
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(null), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const previewExample = formatQuoteNumber(123, {
    prefix: form.quote_number_prefix,
    padWidth: form.quote_number_pad_width,
  });

  return (
    <div className="bg-white border border-edge rounded-[14px] p-5 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-teal-tint rounded-lg flex items-center justify-center">
          <Building2 size={15} className="text-teal" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Business Details</h2>
          <p className="text-xs text-faint">Appear on the rendered quote and customer-facing email.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone" disabled={!isOwner}>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="04xx xxx xxx"
            disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 disabled:bg-surface"
          />
        </Field>

        <Field label="Contact email" disabled={!isOwner}>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="hello@yourcompany.com"
            disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 disabled:bg-surface"
          />
        </Field>

        <Field label="ABN" disabled={!isOwner}>
          <input
            type="text"
            value={form.abn}
            onChange={(e) => setForm({ ...form, abn: e.target.value })}
            placeholder="00 000 000 000"
            disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 disabled:bg-surface"
          />
        </Field>

        <Field label="Business address" disabled={!isOwner}>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="123 Main St, Suburb NSW 2000"
            disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 disabled:bg-surface"
          />
        </Field>
      </div>

      <div className="pt-4 border-t border-edge">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-faint mb-3">
          Quote number format
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,140px,1fr] gap-4 items-start">
          <Field label="Prefix" disabled={!isOwner}>
            <input
              type="text"
              value={form.quote_number_prefix}
              onChange={(e) => setForm({ ...form, quote_number_prefix: e.target.value })}
              placeholder="Q-"
              disabled={!isOwner}
              maxLength={12}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 disabled:bg-surface"
            />
          </Field>
          <Field label="Pad width" disabled={!isOwner}>
            <input
              type="number"
              min={1}
              max={8}
              value={form.quote_number_pad_width}
              onChange={(e) => setForm({ ...form, quote_number_pad_width: Number(e.target.value) || 1 })}
              disabled={!isOwner}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 disabled:bg-surface tabular-nums"
            />
          </Field>
          <div className="pt-[22px]">
            <div className="text-xs text-faint mb-1">Preview</div>
            <div className="px-3 py-2 rounded-lg bg-surface border border-edge-strong text-sm font-medium tabular-nums">
              {previewExample}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {savedAt && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <Check size={12} /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!isOwner || saving || !dirty}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Business Details'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`block text-xs font-medium mb-1.5 ${disabled ? 'text-faint' : 'text-prose'}`}>
        {label}
      </label>
      {children}
    </div>
  );
}
