// components/admin/proposals/quote-builder/sections/ClientDetailsSection.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, FlaskConical, User } from 'lucide-react';
import { supabase, type Proposal } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import SectionCard from '../SectionCard';
import { Button } from '@/components/ui/Button';

interface ClientDetailsSectionProps {
  proposal: Proposal;
  companyId: string;
  onSaved: () => void;
}

interface SavedCustomer {
  client_name: string;
  client_organisation: string | null;
  client_email: string | null;
  crm_identifier: string | null;
  site_address: string | null;
}

const TEST_CUSTOMER: SavedCustomer = {
  client_name: 'Test Customer',
  client_organisation: 'Demo Co Pty Ltd',
  client_email: 'test@example.com',
  crm_identifier: '0400 000 000',
  site_address: '1 Demo Street, Sydney NSW 2000',
};

const FIELDS = [
  { key: 'client_name', label: 'Client Name', placeholder: 'e.g. Jane Smith', required: true },
  { key: 'client_organisation', label: 'Company (Optional)', placeholder: 'e.g. Acme Constructions Pty Ltd' },
  { key: 'client_email', label: 'Email', placeholder: 'name@example.com' },
  { key: 'crm_identifier', label: 'Phone / CRM ID', placeholder: '04xx xxx xxx' },
  { key: 'site_address', label: 'Project Address', placeholder: '123 Main St, Suburb' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

export default function ClientDetailsSection({
  proposal,
  companyId,
  onSaved,
}: ClientDetailsSectionProps) {
  const toast = useToast();
  const [mode, setMode] = useState<'real' | 'test'>(proposal.is_test ? 'test' : 'real');
  const [form, setForm] = useState<Record<FieldKey, string>>({
    client_name: proposal.client_name ?? '',
    client_organisation: proposal.client_organisation ?? '',
    client_email: proposal.client_email ?? '',
    crm_identifier: proposal.crm_identifier ?? '',
    site_address: proposal.site_address ?? '',
  });
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Snapshot of "real" form values so toggling back from Test restores them.
  const realSnapshot = useRef<Record<FieldKey, string>>({ ...form });

  // Load distinct prior customers from this company's proposals, most recent first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('proposals')
        .select('client_name, client_organisation, client_email, crm_identifier, site_address, updated_at')
        .eq('company_id', companyId)
        .not('client_name', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(80);
      if (cancelled || !data) return;
      const seen = new Set<string>();
      const distinct: SavedCustomer[] = [];
      for (const row of data) {
        const key = `${row.client_name}|${row.client_email ?? ''}|${row.crm_identifier ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        distinct.push({
          client_name: row.client_name as string,
          client_organisation: ((row as Record<string, unknown>).client_organisation ?? null) as string | null,
          client_email: (row.client_email ?? null) as string | null,
          crm_identifier: (row.crm_identifier ?? null) as string | null,
          site_address: (row.site_address ?? null) as string | null,
        });
      }
      setSavedCustomers(distinct);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const update = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (mode === 'real') {
      realSnapshot.current = { ...realSnapshot.current, [key]: value };
    }
  };

  const switchMode = async (next: 'real' | 'test') => {
    if (next === mode) return;
    if (next === 'test') {
      realSnapshot.current = { ...form };
      setForm({
        client_name: TEST_CUSTOMER.client_name,
        client_organisation: TEST_CUSTOMER.client_organisation ?? '',
        client_email: TEST_CUSTOMER.client_email ?? '',
        crm_identifier: TEST_CUSTOMER.crm_identifier ?? '',
        site_address: TEST_CUSTOMER.site_address ?? '',
      });
    } else {
      setForm({ ...realSnapshot.current });
    }
    setMode(next);
    // Persist the test/real flag so the header badge and downstream
    // notification suppression stay in sync with the toggle.
    await supabase
      .from('proposals')
      .update({ is_test: next === 'test' })
      .eq('id', proposal.id);
    onSaved();
  };

  const pickCustomer = (c: SavedCustomer) => {
    const next = {
      client_name: c.client_name,
      client_organisation: c.client_organisation ?? '',
      client_email: c.client_email ?? '',
      crm_identifier: c.crm_identifier ?? '',
      site_address: c.site_address ?? '',
    };
    setForm(next);
    realSnapshot.current = next;
    setShowDropdown(false);
  };

  const save = async () => {
    if (!form.client_name.trim()) {
      toast.error('Client name is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('proposals')
      .update({
        client_name: form.client_name.trim(),
        client_organisation: form.client_organisation.trim() || null,
        client_email: form.client_email.trim() || null,
        crm_identifier: form.crm_identifier.trim() || null,
        site_address: form.site_address.trim() || null,
      })
      .eq('id', proposal.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save client');
    } else {
      toast.success('Client details saved');
      onSaved();
    }
  };

  const dirty =
    form.client_name !== (proposal.client_name ?? '') ||
    form.client_organisation !== (proposal.client_organisation ?? '') ||
    form.client_email !== (proposal.client_email ?? '') ||
    form.crm_identifier !== (proposal.crm_identifier ?? '') ||
    form.site_address !== (proposal.site_address ?? '');

  return (
    <SectionCard
      title="Client Details"
      action={
        <div className="inline-flex rounded-lg border border-edge-strong p-0.5 bg-surface">
          <button
            type="button"
            onClick={() => switchMode('real')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              mode === 'real'
                ? 'bg-white text-teal shadow-sm'
                : 'text-dim hover:text-prose'
            }`}
          >
            <User size={12} />
            Real
          </button>
          <button
            type="button"
            onClick={() => switchMode('test')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              mode === 'test'
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-dim hover:text-prose'
            }`}
          >
            <FlaskConical size={12} />
            Test
          </button>
        </div>
      }
    >
      {mode === 'real' && savedCustomers.length > 0 && (
        <div className="relative mb-4">
          <button
            ref={dropdownBtnRef}
            type="button"
            onClick={() => {
              if (!showDropdown && dropdownBtnRef.current) {
                const r = dropdownBtnRef.current.getBoundingClientRect();
                setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
              }
              setShowDropdown((v) => !v);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-edge-strong bg-white text-sm text-prose hover:border-gray-300 transition-colors"
          >
            <span className="truncate">
              {form.client_name
                ? `${form.client_name}${form.crm_identifier ? ` — ${form.crm_identifier}` : ''}`
                : 'Pick a saved customer…'}
            </span>
            <ChevronDown size={14} className="text-faint" />
          </button>
          {showDropdown && dropdownPos && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowDropdown(false)} />
              <div
                className="fixed z-[9999] bg-white rounded-lg border border-edge-strong shadow-lg max-h-72 overflow-y-auto"
                style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
              >
                {savedCustomers.map((c, i) => (
                  <button
                    key={`${c.client_name}-${i}`}
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface"
                  >
                    <div className="font-medium text-ink truncate">{c.client_name}</div>
                    <div className="text-xs text-faint truncate">
                      {[c.crm_identifier, c.client_email].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === 'site_address' ? 'sm:col-span-2' : ''}>
            <label className="block text-xs font-medium text-prose mb-1.5">
              {f.label}
              {'required' in f && f.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input
              type="text"
              value={form[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              disabled={mode === 'test'}
              className="w-full px-3 py-2 rounded-lg border border-edge-strong text-sm focus:outline-none focus:ring-1 focus:ring-teal/30 disabled:bg-surface disabled:text-dim"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-edge">
        <p className="text-xs text-faint">
          {mode === 'test'
            ? 'Test mode — these values won\'t be saved until you switch back to Real.'
            : 'Saved as the client on this quote.'}
        </p>
        <Button
          type="button"
          size="sm"
          loading={saving}
          disabled={mode === 'test' || !dirty}
          onClick={save}
        >
          Save Client
        </Button>
      </div>
    </SectionCard>
  );
}
