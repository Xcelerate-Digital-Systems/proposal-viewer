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
import CustomDomainManager from '@/components/admin/CustomDomainManager';

type CompanyData = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  logo_url: string | null;
  accent_color: string;
  bg_primary: string;
  bg_secondary: string;
  sidebar_text_color: string;
  accept_text_color: string;
  website: string | null;
  current_role: string;
  created_at: string;
  // Cover page branding
  cover_bg_style: 'gradient' | 'solid';
  cover_bg_color_1: string;
  cover_bg_color_2: string;
  cover_text_color: string;
  cover_subtitle_color: string;
  cover_button_bg: string;
  cover_button_text: string;
  cover_overlay_opacity: number;
  cover_gradient_type: 'linear' | 'radial' | 'conic';
  cover_gradient_angle: number;
};

export default function CompanySettingsPage() {
  return (
    <AdminLayout>
      {(auth) => <CompanySettingsContent companyId={auth.companyId ?? ''} />}
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

/**
 * Convert a hex color to rgba for gradients / overlays.
 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
        value={value.slice(0, 7)}
        onChange={(e) => !disabled && onChange(e.target.value)}
        disabled={disabled}
        className="w-8 h-8 rounded cursor-pointer border border-gray-200 bg-transparent disabled:cursor-not-allowed shrink-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => !disabled && e.target.value.length <= 9 && onChange(e.target.value)}
        disabled={disabled}
        className="w-24 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// ---------- Viewer Live Preview ----------
function ViewerPreview({
  accent,
  bgPrimary,
  bgSecondary,
  logoUrl,
  companyName,
  sidebarTextColor,
  acceptTextColor,
}: {
  accent: string;
  bgPrimary: string;
  bgSecondary: string;
  logoUrl: string | null;
  companyName: string;
  sidebarTextColor: string;
  acceptTextColor: string;
}) {
  const border = deriveBorder(bgSecondary);
  const surface = deriveSurface(bgPrimary, bgSecondary);

  return (
    <div
      className="rounded-xl overflow-hidden border shadow-2xl shadow-black/40"
      style={{ borderColor: border }}
    >
      <div className="flex h-[320px]" style={{ backgroundColor: bgPrimary }}>
        {/* Sidebar */}
        <div
          className="w-[160px] shrink-0 flex flex-col border-r"
          style={{ backgroundColor: bgSecondary, borderColor: border }}
        >
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
          <div className="flex-1 py-2 space-y-0.5 px-1">
            {['Executive Summary', 'Our Approach', 'Project Timeline', 'Investment', 'Case Studies', 'Next Steps'].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-1 px-2 py-1.5 rounded text-[9px] truncate"
                style={{
                  color: i === 0 ? sidebarTextColor : `${sidebarTextColor}88`,
                  fontWeight: i === 0 ? 600 : 400,
                  backgroundColor: i === 0 ? `${accent}15` : 'transparent',
                }}
              >
                {i === 1 && <ChevronRight size={8} className="shrink-0 text-[#555]" />}
                {item}
              </div>
            ))}
          </div>
          <div className="p-2 space-y-1.5 border-t" style={{ borderColor: border }}>
            <div
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-semibold"
              style={{ backgroundColor: accent, color: acceptTextColor }}
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

// ---------- Cover Page Live Preview ----------
function CoverPreview({
  bgStyle,
  bgColor1,
  bgColor2,
  textColor,
  subtitleColor,
  buttonBg,
  buttonText,
  overlayOpacity,
  gradientType,
  gradientAngle,
  logoUrl,
  companyName,
}: {
  bgStyle: 'gradient' | 'solid';
  bgColor1: string;
  bgColor2: string;
  textColor: string;
  subtitleColor: string;
  buttonBg: string;
  buttonText: string;
  overlayOpacity: number;
  gradientType: 'linear' | 'radial' | 'conic';
  gradientAngle: number;
  logoUrl: string | null;
  companyName: string;
}) {
  const baseBg = bgStyle === 'solid' ? bgColor1 : undefined;

  function buildGradient(c1: string, c2: string): string {
    switch (gradientType) {
      case 'radial':
        return `radial-gradient(circle, ${c1}, ${c2})`;
      case 'conic':
        return `conic-gradient(from ${gradientAngle}deg, ${c1}, ${c2})`;
      default:
        return `linear-gradient(${gradientAngle}deg, ${c1}, ${c2})`;
    }
  }

  const baseBgImage = bgStyle === 'gradient'
    ? buildGradient(bgColor1, bgColor2)
    : undefined;

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200 shadow-2xl shadow-black/40 relative"
      style={{ backgroundColor: bgColor1 }}
    >
      <div className="relative h-[280px]">
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: baseBg, backgroundImage: baseBgImage }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-5">
          {/* Logo */}
          <div>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-4 max-w-[100px] object-contain" />
            ) : companyName ? (
              <div className="flex items-center gap-1.5">
                <Building2 size={12} style={{ color: subtitleColor }} />
                <span className="text-[10px] font-medium" style={{ color: textColor, opacity: 0.9 }}>{companyName}</span>
              </div>
            ) : (
              <div className="w-14 h-3 rounded bg-white/20" />
            )}
          </div>

          {/* Title area */}
          <div>
            <h3 className="text-base font-semibold leading-tight mb-1" style={{ color: textColor }}>
              Project Proposal
            </h3>
            <p className="text-[11px] mb-3" style={{ color: subtitleColor }}>
              Prepared for Client Name
            </p>
            <div
              className="inline-block px-3 py-1.5 text-[9px] font-semibold tracking-wider uppercase rounded-sm"
              style={{ backgroundColor: buttonBg, color: buttonText }}
            >
              START READING
            </div>
          </div>

          <div />
        </div>

        {/* Overlay opacity indicator */}
        <div className="absolute bottom-2 right-2 z-20">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-white/60">
            overlay: {Math.round(overlayOpacity * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Content ----------
function CompanySettingsContent({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state — viewer branding
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [accentColor, setAccentColor] = useState('#ff6700');
  const [bgPrimary, setBgPrimary] = useState('#0f0f0f');
  const [bgSecondary, setBgSecondary] = useState('#141414');
  const [sidebarTextColor, setSidebarTextColor] = useState('#ffffff');
  const [acceptTextColor, setAcceptTextColor] = useState('#ffffff');
  const [website, setWebsite] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // Form state — cover page branding
  const [coverBgStyle, setCoverBgStyle] = useState<'gradient' | 'solid'>('gradient');
  const [coverBgColor1, setCoverBgColor1] = useState('#0f0f0f');
  const [coverBgColor2, setCoverBgColor2] = useState('#141414');
  const [coverTextColor, setCoverTextColor] = useState('#ffffff');
  const [coverSubtitleColor, setCoverSubtitleColor] = useState('#ffffffb3');
  const [coverButtonBg, setCoverButtonBg] = useState('#ff6700');
  const [coverButtonText, setCoverButtonText] = useState('#ffffff');
  const [coverOverlayOpacity, setCoverOverlayOpacity] = useState(0.65);
  const [coverGradientType, setCoverGradientType] = useState<'linear' | 'radial' | 'conic'>('linear');
  const [coverGradientAngle, setCoverGradientAngle] = useState(135);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = company?.current_role === 'owner';

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Authorization': `Bearer ${session?.access_token}` };
  };

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company?company_id=${companyId}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setCompany(data);
        setName(data.name);
        setSlug(data.slug);
        setAccentColor(data.accent_color || '#ff6700');
        setBgPrimary(data.bg_primary || '#0f0f0f');
        setBgSecondary(data.bg_secondary || '#141414');
        setSidebarTextColor(data.sidebar_text_color || '#ffffff');
        setAcceptTextColor(data.accept_text_color || '#ffffff');
        setWebsite(data.website || '');
        // Cover page
        setCoverBgStyle(data.cover_bg_style || 'gradient');
        setCoverBgColor1(data.cover_bg_color_1 || '#0f0f0f');
        setCoverBgColor2(data.cover_bg_color_2 || '#141414');
        setCoverTextColor(data.cover_text_color || '#ffffff');
        setCoverSubtitleColor(data.cover_subtitle_color || '#ffffffb3');
        setCoverButtonBg(data.cover_button_bg || '#ff6700');
        setCoverButtonText(data.cover_button_text || '#ffffff');
        setCoverOverlayOpacity(parseFloat(data.cover_overlay_opacity) || 0.65);
        setCoverGradientType(data.cover_gradient_type || 'linear');
        setCoverGradientAngle(parseInt(data.cover_gradient_angle) || 135);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchCompany();
  }, [fetchCompany]);

  const showFeedback = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleSaveField = async (field: string, value: string) => {
    if (!isOwner) return;
    setSaving(field);
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, {
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
    const res = await fetch(`/api/company?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accent_color: accentColor,
        bg_primary: bgPrimary,
        bg_secondary: bgSecondary,
        sidebar_text_color: sidebarTextColor,
        accept_text_color: acceptTextColor,
      }),
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

  const handleSaveCoverColors = async () => {
    if (!isOwner) return;
    setSaving('coverColors');
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cover_bg_style: coverBgStyle,
        cover_bg_color_1: coverBgColor1,
        cover_bg_color_2: coverBgColor2,
        cover_text_color: coverTextColor,
        cover_subtitle_color: coverSubtitleColor,
        cover_button_bg: coverButtonBg,
        cover_button_text: coverButtonText,
        cover_overlay_opacity: coverOverlayOpacity,
        cover_gradient_type: coverGradientType,
        cover_gradient_angle: coverGradientAngle,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Failed to save', true);
    } else {
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      showFeedback('Cover page colors saved');
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
    const res = await fetch(`/api/company/logo?company_id=${companyId}`, { method: 'POST', headers, body: formData });
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
    const res = await fetch(`/api/company/logo?company_id=${companyId}`, { method: 'DELETE', headers });
    if (res.ok) {
      setCompany(prev => prev ? { ...prev, logo_path: null, logo_url: null } : prev);
      showFeedback('Logo removed');
    }
    setLogoUploading(false);
  };

  const colorsChanged =
    accentColor !== (company?.accent_color || '#ff6700') ||
    bgPrimary !== (company?.bg_primary || '#0f0f0f') ||
    bgSecondary !== (company?.bg_secondary || '#141414') ||
    sidebarTextColor !== (company?.sidebar_text_color || '#ffffff') ||
    acceptTextColor !== (company?.accept_text_color || '#ffffff');

  const coverColorsChanged =
    coverBgStyle !== (company?.cover_bg_style || 'gradient') ||
    coverBgColor1 !== (company?.cover_bg_color_1 || '#0f0f0f') ||
    coverBgColor2 !== (company?.cover_bg_color_2 || '#141414') ||
    coverTextColor !== (company?.cover_text_color || '#ffffff') ||
    coverSubtitleColor !== (company?.cover_subtitle_color || '#ffffffb3') ||
    coverButtonBg !== (company?.cover_button_bg || '#ff6700') ||
    coverButtonText !== (company?.cover_button_text || '#ffffff') ||
    coverOverlayOpacity !== (parseFloat(String(company?.cover_overlay_opacity)) || 0.65) ||
    coverGradientType !== (company?.cover_gradient_type || 'linear') ||
    coverGradientAngle !== (parseInt(String(company?.cover_gradient_angle)) || 135);

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
          {/* Custom Domain */}
          <CustomDomainManager companyId={companyId} isOwner={isOwner} />

          {/* Branding Colors */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-500">Viewer Colors</span>
              </div>
              {isOwner && colorsChanged && (
                <button
                  onClick={handleSaveColors}
                  disabled={saving === 'colors' || !/^#[0-9a-fA-F]{6}$/.test(accentColor) || !/^#[0-9a-fA-F]{6}$/.test(bgPrimary) || !/^#[0-9a-fA-F]{6}$/.test(bgSecondary) || !/^#[0-9a-fA-F]{6}$/.test(sidebarTextColor) || !/^#[0-9a-fA-F]{6}$/.test(acceptTextColor)}
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

            {/* Text colors */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-xs text-gray-400 mb-2">Text Colors</label>
              <div className="space-y-2">
                <ColorRow label="Sidebar nav text" value={sidebarTextColor} onChange={setSidebarTextColor} disabled={!isOwner} />
                <ColorRow label="Accept button text" value={acceptTextColor} onChange={setAcceptTextColor} disabled={!isOwner} />
              </div>
            </div>
          </div>

          {/* ===== COVER PAGE COLORS ===== */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon size={15} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-500">Cover Page Colors</span>
              </div>
              {isOwner && coverColorsChanged && (
                <button
                  onClick={handleSaveCoverColors}
                  disabled={saving === 'coverColors'}
                  className="px-4 py-1.5 bg-[#017C87] text-white text-sm rounded-lg hover:bg-[#01434A] disabled:opacity-50 transition-colors"
                >
                  {saving === 'coverColors' ? <Loader2 size={14} className="animate-spin" /> : 'Save Cover Colors'}
                </button>
              )}
            </div>

            {/* Background style toggle */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Background Style</label>
              <div className="flex gap-2">
                <button
                  onClick={() => isOwner && setCoverBgStyle('gradient')}
                  disabled={!isOwner}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:cursor-not-allowed ${
                    coverBgStyle === 'gradient'
                      ? 'border-[#017C87] bg-[#017C87]/5 text-[#017C87]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded" style={{ background: coverGradientType === 'radial'
                      ? `radial-gradient(circle, ${coverBgColor1}, ${coverBgColor2})`
                      : coverGradientType === 'conic'
                      ? `conic-gradient(from ${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`
                      : `linear-gradient(${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})` }} />
                    Gradient
                  </div>
                </button>
                <button
                  onClick={() => isOwner && setCoverBgStyle('solid')}
                  disabled={!isOwner}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:cursor-not-allowed ${
                    coverBgStyle === 'solid'
                      ? 'border-[#017C87] bg-[#017C87]/5 text-[#017C87]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: coverBgColor1 }} />
                    Solid
                  </div>
                </button>
              </div>
            </div>

            {/* Gradient Type — only when gradient style is selected */}
            {coverBgStyle === 'gradient' && (
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-2">Gradient Type</label>
                <div className="flex gap-2">
                  {(['linear', 'radial', 'conic'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => isOwner && setCoverGradientType(type)}
                      disabled={!isOwner}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:cursor-not-allowed ${
                        coverGradientType === type
                          ? 'border-[#017C87] bg-[#017C87]/5 text-[#017C87]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className="w-5 h-5 rounded"
                          style={{
                            background: type === 'linear'
                              ? `linear-gradient(${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`
                              : type === 'radial'
                              ? `radial-gradient(circle, ${coverBgColor1}, ${coverBgColor2})`
                              : `conic-gradient(from ${coverGradientAngle}deg, ${coverBgColor1}, ${coverBgColor2})`,
                          }}
                        />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Gradient Angle — for linear and conic only */}
            {coverBgStyle === 'gradient' && coverGradientType !== 'radial' && (
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-2">
                  Gradient Angle — {coverGradientAngle}°
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={coverGradientAngle}
                    onChange={(e) => isOwner && setCoverGradientAngle(parseInt(e.target.value))}
                    disabled={!isOwner}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#017C87] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min="0"
                    max="360"
                    value={coverGradientAngle}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 0 && v <= 360) setCoverGradientAngle(v);
                    }}
                    disabled={!isOwner}
                    className="w-16 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-900 font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                    <button
                      key={deg}
                      onClick={() => isOwner && setCoverGradientAngle(deg)}
                      disabled={!isOwner}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors disabled:cursor-not-allowed ${
                        coverGradientAngle === deg
                          ? 'text-[#017C87] bg-[#017C87]/10 font-medium'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Background colors */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">Background Colors</label>
              <div className="space-y-2">
                <ColorRow
                  label={coverBgStyle === 'gradient' ? 'Gradient start' : 'Background color'}
                  value={coverBgColor1}
                  onChange={setCoverBgColor1}
                  disabled={!isOwner}
                />
                {coverBgStyle === 'gradient' && (
                  <ColorRow
                    label="Gradient end"
                    value={coverBgColor2}
                    onChange={setCoverBgColor2}
                    disabled={!isOwner}
                  />
                )}
              </div>
            </div>

            {/* Overlay opacity */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2">
                Image Overlay Opacity — {Math.round(coverOverlayOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(coverOverlayOpacity * 100)}
                onChange={(e) => isOwner && setCoverOverlayOpacity(parseInt(e.target.value) / 100)}
                disabled={!isOwner}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#017C87] disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-gray-400 mt-1">Controls how much the background color shows over uploaded cover images.</p>
            </div>

            {/* Text colors */}
            <div className="mb-4 pt-4 border-t border-gray-100">
              <label className="block text-xs text-gray-400 mb-2">Text Colors</label>
              <div className="space-y-2">
                <ColorRow label="Title text" value={coverTextColor} onChange={setCoverTextColor} disabled={!isOwner} />
                <ColorRow label="Subtitle text" value={coverSubtitleColor} onChange={setCoverSubtitleColor} disabled={!isOwner} />
              </div>
            </div>

            {/* Button colors */}
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-xs text-gray-400 mb-2">Button Colors</label>
              <div className="space-y-2">
                <ColorRow label="Button background" value={coverButtonBg} onChange={setCoverButtonBg} disabled={!isOwner} />
                <ColorRow label="Button text" value={coverButtonText} onChange={setCoverButtonText} disabled={!isOwner} />
              </div>
            </div>
          </div>

          {!isOwner && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400">Only the company owner can edit these settings.</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Live Previews */}
        <div className="lg:sticky lg:top-8 lg:self-start space-y-6">
          {/* Viewer Preview */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400">Live Preview — Proposal Viewer</h3>
            <ViewerPreview
              accent={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : '#ff6700'}
              bgPrimary={/^#[0-9a-fA-F]{6}$/.test(bgPrimary) ? bgPrimary : '#0f0f0f'}
              bgSecondary={/^#[0-9a-fA-F]{6}$/.test(bgSecondary) ? bgSecondary : '#141414'}
              sidebarTextColor={/^#[0-9a-fA-F]{6}$/.test(sidebarTextColor) ? sidebarTextColor : '#ffffff'}
              acceptTextColor={/^#[0-9a-fA-F]{6}$/.test(acceptTextColor) ? acceptTextColor : '#ffffff'}
              logoUrl={company?.logo_url || null}
              companyName={name}
            />
            <p className="text-xs text-gray-400">
              This is how your proposals will appear to clients.
            </p>
          </div>

          {/* Cover Page Preview */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400">Live Preview — Cover Page</h3>
            <CoverPreview
              bgStyle={coverBgStyle}
              bgColor1={/^#[0-9a-fA-F]{6}$/.test(coverBgColor1) ? coverBgColor1 : '#0f0f0f'}
              bgColor2={/^#[0-9a-fA-F]{6}$/.test(coverBgColor2) ? coverBgColor2 : '#141414'}
              textColor={/^#[0-9a-fA-F]{6,8}$/.test(coverTextColor) ? coverTextColor : '#ffffff'}
              subtitleColor={/^#[0-9a-fA-F]{6,8}$/.test(coverSubtitleColor) ? coverSubtitleColor : '#ffffffb3'}
              buttonBg={/^#[0-9a-fA-F]{6}$/.test(coverButtonBg) ? coverButtonBg : '#ff6700'}
              buttonText={/^#[0-9a-fA-F]{6}$/.test(coverButtonText) ? coverButtonText : '#ffffff'}
              overlayOpacity={coverOverlayOpacity}
              gradientType={coverGradientType}
              gradientAngle={coverGradientAngle}
              logoUrl={company?.logo_url || null}
              companyName={name}
            />
            <p className="text-xs text-gray-400">
              Cover page shown before the proposal. Background image is set per-proposal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}