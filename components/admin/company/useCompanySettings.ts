// components/admin/company/useCompanySettings.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CompanyData } from '@/lib/company-utils';

/* ─── Auth helper ────────────────────────────────────────────────────────── */

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { 'Authorization': `Bearer ${session?.access_token}` };
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */

export function useCompanySettings(companyId: string) {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Profile fields
  const [name, setName]       = useState('');
  const [slug, setSlug]       = useState('');
  const [website, setWebsite] = useState('');

  // Color fields
  const [accentColor, setAccentColor]           = useState('#01434A');
  const [bgPrimary, setBgPrimary]               = useState('#0f0f0f');
  const [bgSecondary, setBgSecondary]           = useState('#141414');
  const [sidebarTextColor, setSidebarTextColor] = useState('#ffffff');
  const [acceptTextColor, setAcceptTextColor]   = useState('#ffffff');

  // Background image
  const [bgImagePath, setBgImagePath]                     = useState<string | null>(null);
  const [bgImageUrl, setBgImageUrl]                       = useState<string | null>(null);
  const [bgImageUploading, setBgImageUploading]           = useState(false);
  const [bgImageOverlayOpacity, setBgImageOverlayOpacity] = useState(0.85);

  // Font fields
  const [fontHeading, setFontHeading]             = useState<string | null>(null);
  const [fontBody, setFontBody]                   = useState<string | null>(null);
  const [fontSidebar, setFontSidebar]             = useState<string | null>(null);
  const [fontHeadingWeight, setFontHeadingWeight] = useState<string | null>(null);
  const [fontBodyWeight, setFontBodyWeight]       = useState<string | null>(null);
  const [fontSidebarWeight, setFontSidebarWeight] = useState<string | null>(null);
  const [fontsSaved, setFontsSaved]               = useState(false);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = company?.current_role === 'owner';

  /* ── Feedback ──────────────────────────────────────────────── */

  const showFeedback = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  /* ── Fetch ─────────────────────────────────────────────────── */

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
        setAccentColor(data.accent_color || '#01434A');
        setBgPrimary(data.bg_primary || '#0f0f0f');
        setBgSecondary(data.bg_secondary || '#141414');
        setSidebarTextColor(data.sidebar_text_color || '#ffffff');
        setAcceptTextColor(data.accept_text_color || '#ffffff');
        setWebsite(data.website || '');
        setFontHeading(data.font_heading || null);
        setFontBody(data.font_body || null);
        setFontSidebar(data.font_sidebar || null);
        setFontHeadingWeight(data.font_heading_weight || null);
        setFontBodyWeight(data.font_body_weight || null);
        setFontSidebarWeight(data.font_sidebar_weight || null);
        setBgImagePath(data.bg_image_path || null);
        setBgImageOverlayOpacity(data.bg_image_overlay_opacity ?? 0.85);
        if (data.bg_image_path) {
          const { data: bgUrl } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.bg_image_path);
          setBgImageUrl(bgUrl?.publicUrl || null);
        } else {
          setBgImageUrl(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchCompany();
  }, [fetchCompany]);

  /* ── Save field ────────────────────────────────────────────── */

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

  /* ── Save colors ───────────────────────────────────────────── */

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
        bg_image_overlay_opacity: bgImageOverlayOpacity,
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

  /* ── Save fonts ────────────────────────────────────────────── */

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
        font_heading_weight: fontHeadingWeight,
        font_body_weight: fontBodyWeight,
        font_sidebar_weight: fontSidebarWeight,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Failed to save fonts', true);
    } else {
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      setFontsSaved(true);
      setTimeout(() => setFontsSaved(false), 2000);
    }
    setSaving(null);
  };

  // Autosave fonts
  const fontsChanged =
    fontHeading !== (company?.font_heading || null) ||
    fontBody !== (company?.font_body || null) ||
    fontSidebar !== (company?.font_sidebar || null) ||
    fontHeadingWeight !== (company?.font_heading_weight || null) ||
    fontBodyWeight !== (company?.font_body_weight || null) ||
    fontSidebarWeight !== (company?.font_sidebar_weight || null);

  useEffect(() => {
    if (!fontsChanged || !isOwner || !company) return;
    const timer = setTimeout(() => {
      handleSaveFonts();
    }, 800);
    return () => clearTimeout(timer);
  }, [fontHeading, fontBody, fontSidebar, fontHeadingWeight, fontBodyWeight, fontSidebarWeight]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Logo ──────────────────────────────────────────────────── */

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

  /* ── Background image ──────────────────────────────────────── */

  const handleBgImageUpload = async (file: File) => {
    if (!isOwner) return;
    setBgImageUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = `bg-image.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '');
      const storagePath = `${companyId}/bg-image/${safeName}`;

      if (bgImagePath) {
        await supabase.storage.from('company-assets').remove([bgImagePath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg_image_path: storagePath }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setBgImagePath(storagePath);
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(storagePath);
      setBgImageUrl(urlData?.publicUrl || null);
      setCompany(prev => prev ? { ...prev, bg_image_path: storagePath } : prev);
      showFeedback('Background image uploaded');
    } catch (err) {
      console.error(err);
      showFeedback('Failed to upload background image', true);
    } finally {
      setBgImageUploading(false);
    }
  };

  const handleBgImageRemove = async () => {
    if (!isOwner || !bgImagePath) return;
    try {
      await supabase.storage.from('company-assets').remove([bgImagePath]);

      const headers = await getAuthHeaders();
      await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg_image_path: null }),
      });

      setBgImagePath(null);
      setBgImageUrl(null);
      setCompany(prev => prev ? { ...prev, bg_image_path: null } : prev);
      showFeedback('Background image removed');
    } catch (err) {
      console.error(err);
      showFeedback('Failed to remove background image', true);
    }
  };

  /* ── Derived ───────────────────────────────────────────────── */

  const colorsChanged =
    accentColor !== (company?.accent_color || '#01434A') ||
    bgPrimary !== (company?.bg_primary || '#0f0f0f') ||
    bgSecondary !== (company?.bg_secondary || '#141414') ||
    sidebarTextColor !== (company?.sidebar_text_color || '#ffffff') ||
    acceptTextColor !== (company?.accept_text_color || '#ffffff') ||
    bgImageOverlayOpacity !== (company?.bg_image_overlay_opacity ?? 0.85);

  return {
    // Core
    company,
    loading,
    saving,
    error,
    success,
    isOwner,

    // Profile
    name, setName,
    slug, setSlug,
    website, setWebsite,
    handleSaveField,

    // Logo
    logoUploading,
    fileInputRef,
    handleLogoUpload,
    handleLogoRemove,

    // Colors
    accentColor, setAccentColor,
    bgPrimary, setBgPrimary,
    bgSecondary, setBgSecondary,
    sidebarTextColor, setSidebarTextColor,
    acceptTextColor, setAcceptTextColor,
    colorsChanged,
    handleSaveColors,

    // Background image
    bgImageUrl,
    bgImageUploading,
    bgImageOverlayOpacity, setBgImageOverlayOpacity,
    handleBgImageUpload,
    handleBgImageRemove,

    // Fonts
    fontHeading, setFontHeading,
    fontBody, setFontBody,
    fontSidebar, setFontSidebar,
    fontHeadingWeight, setFontHeadingWeight,
    fontBodyWeight, setFontBodyWeight,
    fontSidebarWeight, setFontSidebarWeight,
    fontsChanged,
    fontsSaved,
    handleSaveFonts,
  };
}
