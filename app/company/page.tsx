// app/company/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, Upload, Trash2, Loader2,
  Check, Globe, Palette, Link2, Image as ImageIcon,
  CheckCircle2, MessageSquare, ChevronRight,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/lib/supabase';

type CompanyData = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  logo_url: string | null;
  accent_color: string;
  bg_primary: string;
  bg_secondary: string;
  website: string | null;
  current_role: string;
  created_at: string;
};

export default function CompanySettingsPage() {
  return (
    <AdminLayout>
      {() => <CompanySettingsContent />}
    </AdminLayout>
  );
}

/**
 * Derive a border color by lightening the secondary bg.
 */
function deriveBorder(bgSecondary: string): string {
  const hex = bgSecondary.replace('#', '');
  const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 22);
  const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 22);
  const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 22);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Derive a surface color between primary and secondary + small offset.
 */
function deriveSurface(bgPrimary: string, bgSecondary: string): string {
  const p = bgPrimary.replace('#', '');
  const s = bgSecondary.replace('#', '');
  const r = Math.round((parseInt(p.slice(0, 2), 16) + parseInt(s.slice(0, 2), 16)) / 2 + 4);
  const g = Math.round((parseInt(p.slice(2, 4), 16) + parseInt(s.slice(2, 4), 16)) / 2 + 4);
  const b = Math.round((parseInt(p.slice(4, 6), 16) + parseInt(s.slice(4, 6), 16)) / 2 + 4);
  return `#${Math.min(255, r).toString(16).padStart(2, '0')}${Math.min(255, g).toString(16).padStart(2, '0')}${Math.min(255, b).toString(16).padStart(2, '0')}`;
}

// ---------- Color Picker Row ----------
function ColorRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => !disabled && onChange(e.target.value)}
        disabled={disabled}
        className="w-8 h-8 rounded cursor-pointer border border-gray-200 bg-transparent disabled:cursor-not-allowed shrink-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => !disabled && e.target.value.length <= 7 && onChange(e.target.value)}
        disabled={disabled}
        className="w-24 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// ---------- Live Preview ----------
function ViewerPreview({
  accent,
  bgPrimary,
  bgSecondary,
  logoUrl,
  companyName,
}: {
  accent: string;
  bgPrimary: string;
  bgSecondary: string;
  logoUrl: string | null;
  companyName: string;
}) {
  const border = deriveBorder(bgSecondary);
  const surface = deriveSurface(bgPrimary, bgSecondary);

  return (
    <div
      className="rounded-xl overflow-hidden border shadow-2xl shadow-black/40"
      style={{ borderColor: border }}
    >
      {/* Mini viewer layout */}
      <div className="flex h-[320px]" style={{ backgroundColor: bgPrimary }}>
        {/* Sidebar */}
        <div
          className="w-[160px] shrink-0 flex flex-col border-r"
          style={{ backgroundColor: bgSecondary, borderColor: border }}
        >
          {/* Logo area */}
          <div className="px-3 py-2.5 border-b flex items-center gap-1.5" style={{ borderColor: border }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-4 max-w-[120px] object-contain" />
            ) : companyName ? (
              <div className="flex items-center gap-1.5">
                <Building2 size={12} className="text-[#555]" />
                <span className="text-[10px] text-white font-medium truncate">{companyName}</span>
              </div>
            ) : (
              <div className="w-16 h-3 rounded" style={{ backgroundColor: border }} />
            )}
          </div>

          {/* Nav items */}
          <div className="flex-1 py-2 space-y-0.5 px-1">
            {['Executive Summary', 'Our Approach', 'Project Timeline', 'Investment', 'Case Studies', 'Next Steps'].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-1 px-2 py-1.5 rounded text-[9px] truncate"
                style={{
                  color: i === 0 ? '#fff' : '#888',
                  fontWeight: i === 0 ? 600 : 400,
                  backgroundColor: i === 0 ? `${accent}15` : 'transparent',
                }}
              >
                {i === 1 && <ChevronRight size={8} className="shrink-0 text-[#555]" />}
                {item}
              </div>
            ))}
          </div>

          {/* Bottom buttons */}
          <div className="p-2 space-y-1.5 border-t" style={{ borderColor: border }}>
            <div
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              <CheckCircle2 size={10} />
              Accept Proposal
            </div>
            <div
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-medium border"
              style={{
                backgroundColor: `${accent}15`,
                borderColor: `${accent}40`,
                color: accent,
              }}
            >
              <MessageSquare size={10} />
              Comments
              <span
                className="text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${accent}30`, color: accent }}
              >
                3
              </span>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[260px] space-y-3">
            {/* Fake slide content */}
            <div
              className="rounded-lg p-4 border"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <div className="w-3/4 h-2.5 rounded mb-3" style={{ backgroundColor: border }} />
              <div className="w-full h-2 rounded mb-2" style={{ backgroundColor: `${border}80` }} />
              <div className="w-5/6 h-2 rounded mb-2" style={{ backgroundColor: `${border}80` }} />
              <div className="w-2/3 h-2 rounded mb-4" style={{ backgroundColor: `${border}80` }} />
              <div className="flex gap-2">
                <div className="w-12 h-6 rounded" style={{ backgroundColor: accent, opacity: 0.8 }} />
                <div className="w-12 h-6 rounded border" style={{ borderColor: border }} />
              </div>
            </div>
            {/* Fake image placeholder */}
            <div
              className="rounded-lg h-16 border flex items-center justify-center"
              style={{ backgroundColor: surface, borderColor: border }}
            >
              <ImageIcon size={16} style={{ color: `${border}` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Content ----------
function CompanySettingsContent() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [accentColor, setAccentColor] = useState('#ff6700');
  const [bgPrimary, setBgPrimary] = useState('#0f0f0f');
  const [bgSecondary, setBgSecondary] = useState('#141414');
  const [website, setWebsite] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = company?.current_role === 'owner';

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Authorization': `Bearer ${session?.access_token}` };
  };

  const fetchCompany = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/company', { headers });
      const data = await res.json();
      if (res.ok) {
        setCompany(data);
        setName(data.name);
        setSlug(data.slug);
        setAccentColor(data.accent_color || '#ff6700');
        setBgPrimary(data.bg_primary || '#0f0f0f');
        setBgSecondary(data.bg_secondary || '#141414');
        setWebsite(data.website || '');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  const showFeedback = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleSaveField = async (field: string, value: string) => {
    if (!isOwner) return;
    setSaving(field);
    const headers = await getAuthHeaders();
    const res = await fetch('/api/company', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Failed to save', true);
    } else {
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      showFeedback('Saved');
    }
    setSaving(null);
  };

  const handleSaveColors = async () => {
    if (!isOwner) return;
    setSaving('colors');
    const headers = await getAuthHeaders();
    const res = await fetch('/api/company', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accent_color: accentColor, bg_primary: bgPrimary, bg_secondary: bgSecondary }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Failed to save', true);
    } else {
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      showFeedback('Branding saved');
    }
    setSaving(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const headers = await getAuthHeaders();
    const formData = new FormData();
    formData.append('logo', file);
    const res = await fetch('/api/company/logo', { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Upload failed', true);
    } else {
      setCompany(prev => prev ? { ...prev, logo_path: data.logo_path, logo_url: `${data.logo_url}?t=${Date.now()}` } : prev);
      showFeedback('Logo uploaded');
    }
    setLogoUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogoRemove = async () => {
    if (!confirm('Remove company logo?')) return;
    setLogoUploading(true);
    const headers = await getAuthHeaders();
    const res = await fetch('/api/company/logo', { method: 'DELETE', headers });
    if (res.ok) {
      setCompany(prev => prev ? { ...prev, logo_path: null, logo_url: null } : prev);
      showFeedback('Logo removed');
    }
    setLogoUploading(false);
  };

  const colorsChanged =
    accentColor !== (company?.accent_color || '#ff6700') ||
    bgPrimary !== (company?.bg_primary || '#0f0f0f') ||
    bgSecondary !== (company?.bg_secondary || '#141414');

  const ACCENT_PRESETS = [
    '#ff6700', '#ef4444', '#f59e0b', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  ];

  const BG_PRESETS = [
    { label: 'Midnight', primary: '#0f0f0f', secondary: '#141414' },
    { label: 'Charcoal', primary: '#1a1a1a', secondary: '#222222' },
    { label: 'Slate', primary: '#0f172a', secondary: '#1e293b' },
    { label: 'Navy', primary: '#0c1222', secondary: '#162032' },
    { label: 'Forest', primary: '#0a1410', secondary: '#121f19' },
    { label: 'Wine', primary: '#1a0a0f', secondary: '#261018' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-10 py-8">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-[#017C87]/10 rounded-xl flex items-center justify-center">
          <Building2 size={20} className="text-[#017C87]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Company Settings</h1>
          <p className="text-sm text-gray-400">
            {isOwner ? 'Manage your company profile and branding' : 'View company profile'}
          </p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="mb-4 text-xs text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-lg flex items-center gap-1.5">
          <Check size={12} /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN — Settings */}
        <div className="space-y-5">
          {/* Logo */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon size={15} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Company Logo</span>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                {company?.logo_url ? (
                  <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <Building2 size={28} className="text-gray-200" />
                )}
              </div>
              {isOwner && (
                <div className="space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Upload Logo
                  </button>
                  {company?.logo_url && (
                    <button onClick={handleLogoRemove} disabled={logoUploading} className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:text-red-600 transition-colors">
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                  <p className="text-xs text-gray-400">PNG, JPEG, SVG, or WebP. Max 2MB.</p>
                </div>
              )}
            </div>
          </div>

          {/* Company Name */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <label className="block text-sm font-medium text-gray-500 mb-2">Company Name</label>
            <div className="flex gap-2">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed" />
              {isOwner && name !== company?.name && (
                <button onClick={() => handleSaveField('name', name)} disabled={saving === 'name' || !name.trim()}
                  className="px-4 py-2 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors">
                  {saving === 'name' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
              )}
            </div>
          </div>

          {/* Slug */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={14} className="text-gray-400" />
              <label className="text-sm font-medium text-gray-500">URL Slug</label>
            </div>
            <div className="flex gap-2">
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} disabled={!isOwner}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed" />
              {isOwner && slug !== company?.slug && (
                <button onClick={() => handleSaveField('slug', slug)} disabled={saving === 'slug' || slug.length < 2}
                  className="px-4 py-2 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors">
                  {saving === 'slug' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Lowercase letters, numbers, and hyphens only.</p>
          </div>

          {/* Website */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-gray-400" />
              <label className="text-sm font-medium text-gray-500">Website</label>
            </div>
            <div className="flex gap-2">
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourcompany.com" disabled={!isOwner}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed" />
              {isOwner && website !== (company?.website || '') && (
                <button onClick={() => handleSaveField('website', website)} disabled={saving === 'website'}
                  className="px-4 py-2 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors">
                  {saving === 'website' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
              )}
            </div>
          </div>

          {/* Branding Colors */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-500">Branding Colors</span>
              </div>
              {isOwner && colorsChanged && (
                <button
                  onClick={handleSaveColors}
                  disabled={saving === 'colors' || !/^#[0-9a-fA-F]{6}$/.test(accentColor) || !/^#[0-9a-fA-F]{6}$/.test(bgPrimary) || !/^#[0-9a-fA-F]{6}$/.test(bgSecondary)}
                  className="px-4 py-1.5 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors"
                >
                  {saving === 'colors' ? <Loader2 size={14} className="animate-spin" /> : 'Save Colors'}
                </button>
              )}
            </div>

            {/* Accent color */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Accent Color</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => isOwner && setAccentColor(color)}
                    disabled={!isOwner}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${
                      accentColor === color ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-300'
                    } disabled:cursor-not-allowed`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <ColorRow label="Buttons, links, highlights" value={accentColor} onChange={setAccentColor} disabled={!isOwner} />
            </div>

            {/* Background presets */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Background Theme</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {BG_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      if (!isOwner) return;
                      setBgPrimary(preset.primary);
                      setBgSecondary(preset.secondary);
                    }}
                    disabled={!isOwner}
                    className={`rounded-lg border-2 p-2 text-center transition-all disabled:cursor-not-allowed ${
                      bgPrimary === preset.primary && bgSecondary === preset.secondary
                        ? 'border-gray-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ backgroundColor: preset.primary }}
                  >
                    <div className="flex gap-1 justify-center mb-1.5">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary, border: `1px solid ${deriveBorder(preset.secondary)}` }} />
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.secondary, border: `1px solid ${deriveBorder(preset.secondary)}` }} />
                    </div>
                    <span className="text-[10px] text-[#888]">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom bg inputs */}
            <div className="space-y-2">
              <ColorRow label="Main background" value={bgPrimary} onChange={setBgPrimary} disabled={!isOwner} />
              <ColorRow label="Sidebar / panels" value={bgSecondary} onChange={setBgSecondary} disabled={!isOwner} />
            </div>
          </div>

          {!isOwner && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400">Only the company owner can edit these settings.</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Live Preview */}
        <div className="lg:sticky lg:top-8 lg:self-start space-y-3">
          <h3 className="text-sm font-medium text-gray-400">Live Preview — Proposal Viewer</h3>
          <ViewerPreview
            accent={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : '#ff6700'}
            bgPrimary={/^#[0-9a-fA-F]{6}$/.test(bgPrimary) ? bgPrimary : '#0f0f0f'}
            bgSecondary={/^#[0-9a-fA-F]{6}$/.test(bgSecondary) ? bgSecondary : '#141414'}
            logoUrl={company?.logo_url || null}
            companyName={name}
          />
          <p className="text-xs text-gray-400">
            This is how your proposals will appear to clients. Colors update in real-time as you edit.
          </p>
        </div>
      </div>
    </div>
  );
}