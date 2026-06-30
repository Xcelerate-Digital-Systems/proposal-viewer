'use client';

import { useState } from 'react';
import { Building2, Loader2, Upload, ArrowRight } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { Button } from '@/components/ui/Button';
import { type CompanyShape } from './onboarding-types';

export function AgencyStep({
  company,
  onSaved,
}: {
  company: CompanyShape;
  onSaved: (updated: CompanyShape) => void;
}) {
  const [name, setName] = useState(company.name);
  const [accent, setAccent] = useState<string>(company.accent_color || '#017C87');
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo_url);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadLogo = async (file: File) => {
    setError(null);
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await authFetch(`/api/company/logo?company_id=${company.id}`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Logo upload failed');
        return;
      }
      setLogoPreview(json.logo_url || null);
    } catch {
      setError('Network error uploading logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Agency name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/company?company_id=${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          accent_color: accent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to save');
        setSaving(false);
        return;
      }
      onSaved({ ...company, name: name.trim(), accent_color: accent });
    } catch {
      setError('Network error');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleContinue} className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-teal-tint rounded-2xl flex items-center justify-center">
          <Building2 size={20} className="text-teal" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink">Your agency</h2>
          <p className="text-xs text-muted">Name, logo, and brand color. You can change these later.</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink mb-1.5">Agency name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink mb-1.5">Logo</label>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg border border-dashed border-edge bg-surface flex items-center justify-center overflow-hidden">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <Upload size={18} className="text-faint" />
            )}
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-edge text-sm text-ink hover:bg-surface cursor-pointer">
            {uploadingLogo ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            <span>{logoPreview ? 'Replace' : 'Upload'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
              }}
            />
          </label>
          <span className="text-2xs text-faint">PNG, JPEG, SVG, or WebP. Max 2 MB.</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink mb-1.5">Accent color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="w-12 h-10 rounded-lg border border-edge cursor-pointer bg-white p-1"
          />
          <input
            type="text"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            pattern="^#[0-9a-fA-F]{6}$"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="pt-2">
        <Button type="submit" fullWidth loading={saving} rightIcon={ArrowRight}>
          Continue
        </Button>
      </div>
    </form>
  );
}
