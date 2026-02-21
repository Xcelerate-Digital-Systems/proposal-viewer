// app/company/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, Upload, Trash2, Loader2,
  Check, Globe, Link2, Image as ImageIcon,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/lib/supabase';
import CustomDomainManager from '@/components/admin/CustomDomainManager';
import { CompanyData, isValidHex6, isValidHex6or8 } from '@/lib/company-utils';
import ViewerPreview from '@/components/admin/company/ViewerPreview';
import CoverPreview from '@/components/admin/company/CoverPreview';
import ViewerColorsSection from '@/components/admin/company/ViewerColorsSection';
import CoverColorsSection from '@/components/admin/company/CoverColorsSection';
import ViewerFontsSection from '@/components/admin/company/ViewerFontsSection';

export default function CompanySettingsPage() {
  return (
    <AdminLayout>
      {(auth) => <CompanySettingsContent companyId={auth.companyId ?? ''} />}
    </AdminLayout>
  );
}

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

  // Font state
  const [fontHeading, setFontHeading] = useState<string | null>(null);
  const [fontBody, setFontBody] = useState<string | null>(null);
  const [fontSidebar, setFontSidebar] = useState<string | null>(null);

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
        setFontHeading(data.font_heading || null);
        setFontBody(data.font_body || null);
        setFontSidebar(data.font_sidebar || null);
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

  const handleSaveFonts = async () => {
    if (!isOwner) return;
    setSaving('fonts');
    setError('');
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        font_heading: fontHeading,
        font_body: fontBody,
        font_sidebar: fontSidebar,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Failed to save fonts', true);
    } else {
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      showFeedback('Fonts saved');
      fetchCompany();
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

  const fontsChanged =
    fontHeading !== (company?.font_heading || null) ||
    fontBody !== (company?.font_body || null) ||
    fontSidebar !== (company?.font_sidebar || null);

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

          {/* Viewer Colors */}
          <ViewerColorsSection
            isOwner={isOwner}
            saving={saving}
            colorsChanged={colorsChanged}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            bgPrimary={bgPrimary}
            setBgPrimary={setBgPrimary}
            bgSecondary={bgSecondary}
            setBgSecondary={setBgSecondary}
            sidebarTextColor={sidebarTextColor}
            setSidebarTextColor={setSidebarTextColor}
            acceptTextColor={acceptTextColor}
            setAcceptTextColor={setAcceptTextColor}
            onSave={handleSaveColors}
          />

          {/* Cover Page Colors */}
          <CoverColorsSection
            isOwner={isOwner}
            saving={saving}
            coverColorsChanged={coverColorsChanged}
            onSave={handleSaveCoverColors}
            coverBgStyle={coverBgStyle}
            setCoverBgStyle={setCoverBgStyle}
            coverGradientType={coverGradientType}
            setCoverGradientType={setCoverGradientType}
            coverGradientAngle={coverGradientAngle}
            setCoverGradientAngle={setCoverGradientAngle}
            coverBgColor1={coverBgColor1}
            setCoverBgColor1={setCoverBgColor1}
            coverBgColor2={coverBgColor2}
            setCoverBgColor2={setCoverBgColor2}
            coverOverlayOpacity={coverOverlayOpacity}
            setCoverOverlayOpacity={setCoverOverlayOpacity}
            coverTextColor={coverTextColor}
            setCoverTextColor={setCoverTextColor}
            coverSubtitleColor={coverSubtitleColor}
            setCoverSubtitleColor={setCoverSubtitleColor}
            coverButtonBg={coverButtonBg}
            setCoverButtonBg={setCoverButtonBg}
            coverButtonText={coverButtonText}
            setCoverButtonText={setCoverButtonText}
          />

          {/* Viewer Fonts */}
          <ViewerFontsSection
            isOwner={isOwner}
            saving={saving}
            fontsChanged={fontsChanged}
            fontHeading={fontHeading}
            setFontHeading={setFontHeading}
            fontBody={fontBody}
            setFontBody={setFontBody}
            fontSidebar={fontSidebar}
            setFontSidebar={setFontSidebar}
            onSave={handleSaveFonts}
          />

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
              accent={isValidHex6(accentColor) ? accentColor : '#ff6700'}
              bgPrimary={isValidHex6(bgPrimary) ? bgPrimary : '#0f0f0f'}
              bgSecondary={isValidHex6(bgSecondary) ? bgSecondary : '#141414'}
              sidebarTextColor={isValidHex6(sidebarTextColor) ? sidebarTextColor : '#ffffff'}
              acceptTextColor={isValidHex6(acceptTextColor) ? acceptTextColor : '#ffffff'}
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
              bgColor1={isValidHex6(coverBgColor1) ? coverBgColor1 : '#0f0f0f'}
              bgColor2={isValidHex6(coverBgColor2) ? coverBgColor2 : '#141414'}
              textColor={isValidHex6or8(coverTextColor) ? coverTextColor : '#ffffff'}
              subtitleColor={isValidHex6or8(coverSubtitleColor) ? coverSubtitleColor : '#ffffffb3'}
              buttonBg={isValidHex6(coverButtonBg) ? coverButtonBg : '#ff6700'}
              buttonText={isValidHex6(coverButtonText) ? coverButtonText : '#ffffff'}
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