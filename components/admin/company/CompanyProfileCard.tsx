// components/admin/company/CompanyProfileCard.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Upload, Trash2, Loader2, Globe, Link2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

async function getAuthHeaders(): Promise<HeadersInit> {
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
  name: string;
  slug: string;
  website: string;
  logo_url: string | null;
}

export default function CompanyProfileCard({ companyId, isOwner }: Props) {
  const [form, setForm] = useState<FormState>({ name: '', slug: '', website: '', logo_url: null });
  const [initial, setInitial] = useState<FormState>({ name: '', slug: '', website: '', logo_url: null });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCompany = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, { headers });
    if (!res.ok) return;
    const d = await res.json();
    const loaded: FormState = {
      name: d.name ?? '',
      slug: d.slug ?? '',
      website: d.website ?? '',
      logo_url: d.logo_url ?? null,
    };
    setForm(loaded);
    setInitial(loaded);
  }, [companyId]);

  useEffect(() => {
    if (companyId) fetchCompany();
  }, [companyId, fetchCompany]);

  const dirty =
    form.name !== initial.name ||
    form.slug !== initial.slug ||
    form.website !== initial.website;

  const save = async () => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: form.name.trim() || null,
          slug: form.slug.trim() || null,
          website: form.website.trim() || null,
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isOwner) return;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${companyId}/logo-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true });
      if (uploadErr) return;
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(path);
      const headers = await getAuthHeaders();
      await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ logo_path: path }),
      });
      setForm((prev) => ({ ...prev, logo_url: publicUrl }));
      setInitial((prev) => ({ ...prev, logo_url: publicUrl }));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!isOwner) return;
    setLogoUploading(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ logo_path: null }),
      });
      setForm((prev) => ({ ...prev, logo_url: null }));
      setInitial((prev) => ({ ...prev, logo_url: null }));
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="bg-white border border-edge rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-faint" />
          <span className="text-sm font-medium text-muted">Company Profile</span>
        </div>
        {savedAt && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div className="flex items-start gap-6 mb-5">
        <div className="w-20 h-20 bg-surface border border-edge rounded-[14px] flex items-center justify-center overflow-hidden shrink-0">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
          ) : (
            <Building2 size={28} className="text-edge-hover" />
          )}
        </div>
        {isOwner && (
          <div className="space-y-2 pt-1">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-edge text-sm text-muted rounded-lg hover:bg-edge disabled:opacity-50 transition-colors"
            >
              {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload Logo
            </button>
            {form.logo_url && (
              <button onClick={handleLogoRemove} disabled={logoUploading} className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:text-red-600 transition-colors">
                <Trash2 size={14} /> Remove
              </button>
            )}
            <p className="text-xs text-faint">PNG, JPEG, SVG, or WebP. Max 2MB.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1.5">Company Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 disabled:opacity-50 disabled:cursor-not-allowed" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link2 size={14} className="text-faint" />
            <label className="text-sm font-medium text-muted">URL Slug</label>
          </div>
          <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink font-mono placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 disabled:opacity-50 disabled:cursor-not-allowed" />
          <p className="text-xs text-faint mt-1">Lowercase letters, numbers, and hyphens only. Minimum 2 characters.</p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Globe size={14} className="text-faint" />
            <label className="text-sm font-medium text-muted">Website</label>
          </div>
          <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourcompany.com" disabled={!isOwner}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 disabled:opacity-50 disabled:cursor-not-allowed" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={!isOwner || saving || !dirty}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
