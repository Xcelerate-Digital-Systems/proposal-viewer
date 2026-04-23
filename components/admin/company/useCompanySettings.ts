// components/admin/company/useCompanySettings.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CompanyData, isValidHex6 } from '@/lib/company-utils';
import { setBrandingColors } from '@/components/ui/ColorPickerField';

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
  const [profileSaved, setProfileSaved] = useState(false);

  // Color fields
  const [accentColor, setAccentColor]           = useState('#01434A');
  const [bgPrimary, setBgPrimary]               = useState('#0f0f0f');
  const [bgSecondary, setBgSecondary]           = useState('#141414');
  const [sidebarTextColor, setSidebarTextColor] = useState('#ffffff');
  const [acceptTextColor, setAcceptTextColor]   = useState('#ffffff');
  const [colorsSaved, setColorsSaved]           = useState(false);

  // Brand palette
  const [brandColors, setBrandColors]           = useState<string[]>([]);
  const [brandColorsSaved, setBrandColorsSaved] = useState(false);
  const [brandColorsError, setBrandColorsError] = useState<string | null>(null);

  // Background image
  const [bgImagePath, setBgImagePath]                     = useState<string | null>(null);
  const [bgImageUrl, setBgImageUrl]                       = useState<string | null>(null);
  const [bgImageUploading, setBgImageUploading]           = useState(false);
  const [bgImageOverlayOpacity, setBgImageOverlayOpacity] = useState(0.85);

  // Cover image (company default for new proposals)
  const [coverImagePath, setCoverImagePath]         = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl]           = useState<string | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);


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
        setCoverImagePath(data.cover_image_path || null);

        // Brand palette
        const palette: string[] = Array.isArray(data.brand_colors) ? data.brand_colors : [];
        setBrandColors(palette);
        setBrandingColors(palette);

        if (data.bg_image_path) {
          const { data: bgUrl } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.bg_image_path);
          setBgImageUrl(bgUrl?.publicUrl || null);
        } else {
          setBgImageUrl(null);
        }

        if (data.cover_image_path) {
          const { data: coverUrl } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.cover_image_path);
          setCoverImageUrl(coverUrl?.publicUrl || null);
        } else {
          setCoverImageUrl(null);
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
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
    setSaving(null);
  };

  // Autosave profile fields (debounced). Each field has its own validity
  // guard so in-progress typing doesn't PATCH an empty name or tiny slug.
  useEffect(() => {
    if (!isOwner || !company) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === company.name) return;
    const timer = setTimeout(() => handleSaveField('name', trimmed), 800);
    return () => clearTimeout(timer);
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOwner || !company) return;
    if (slug.length < 2 || slug === company.slug) return;
    const timer = setTimeout(() => handleSaveField('slug', slug), 800);
    return () => clearTimeout(timer);
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOwner || !company) return;
    if (website === (company.website || '')) return;
    const timer = setTimeout(() => handleSaveField('website', website), 800);
    return () => clearTimeout(timer);
  }, [website]); // eslint-disable-line react-hooks/exhaustive-deps

  const profileChanged = !!company && (
    name.trim() !== company.name ||
    slug !== company.slug ||
    website !== (company.website || '')
  );

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
      setColorsSaved(true);
      setTimeout(() => setColorsSaved(false), 2000);
    }
    setSaving(null);
  };

  // Autosave viewer colours (debounced). Skips invalid hex values so
  // we don't PATCH while a user is mid-typing in the hex input.
  const colorsChanged =
    accentColor !== (company?.accent_color || '#01434A') ||
    bgPrimary !== (company?.bg_primary || '#0f0f0f') ||
    bgSecondary !== (company?.bg_secondary || '#141414') ||
    sidebarTextColor !== (company?.sidebar_text_color || '#ffffff') ||
    acceptTextColor !== (company?.accept_text_color || '#ffffff') ||
    bgImageOverlayOpacity !== (company?.bg_image_overlay_opacity ?? 0.85);

  useEffect(() => {
    if (!colorsChanged || !isOwner || !company) return;
    if (
      !isValidHex6(accentColor) ||
      !isValidHex6(bgPrimary) ||
      !isValidHex6(bgSecondary) ||
      !isValidHex6(sidebarTextColor) ||
      !isValidHex6(acceptTextColor)
    ) return;
    const timer = setTimeout(() => {
      handleSaveColors();
    }, 800);
    return () => clearTimeout(timer);
  }, [accentColor, bgPrimary, bgSecondary, sidebarTextColor, acceptTextColor, bgImageOverlayOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ── Brand colors ──────────────────────────────────────────── */

  const handleSaveBrandColors = async (colors: string[]) => {
    if (!isOwner) return;
    setSaving('brand_colors');
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_colors: colors }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBrandColorsError(data.error || 'Failed to save brand colours');
    } else {
      setBrandColorsError(null);
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      setBrandColorsSaved(true);
      setTimeout(() => setBrandColorsSaved(false), 2000);
    }
    setSaving(null);
  };

  // Sync global picker palette whenever brand colors change
  // and autosave after a short debounce
  const brandColorsChanged =
    JSON.stringify(brandColors) !== JSON.stringify(Array.isArray(company?.brand_colors) ? company.brand_colors : []);

  useEffect(() => {
    setBrandingColors(brandColors);
  }, [brandColors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!brandColorsChanged || !isOwner || !company) return;
    const timer = setTimeout(() => {
      handleSaveBrandColors(brandColors);
    }, 800);
    return () => clearTimeout(timer);
  }, [brandColors]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ── Cover image (company default for new proposals) ─────── */

  const handleCoverImageUpload = async (file: File) => {
    if (!isOwner) return;
    setCoverImageUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = `cover-image.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '');
      const storagePath = `${companyId}/cover-image/${safeName}`;

      if (coverImagePath) {
        await supabase.storage.from('company-assets').remove([coverImagePath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_path: storagePath }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setCoverImagePath(storagePath);
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(storagePath);
      setCoverImageUrl(urlData?.publicUrl || null);
      setCompany(prev => prev ? { ...prev, cover_image_path: storagePath } : prev);
      showFeedback('Cover image uploaded');
    } catch (err) {
      console.error(err);
      showFeedback('Failed to upload cover image', true);
    } finally {
      setCoverImageUploading(false);
    }
  };

  const handleCoverImageRemove = async () => {
    if (!isOwner || !coverImagePath) return;
    try {
      await supabase.storage.from('company-assets').remove([coverImagePath]);

      const headers = await getAuthHeaders();
      await fetch(`/api/company?company_id=${companyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_path: null }),
      });

      setCoverImagePath(null);
      setCoverImageUrl(null);
      setCompany(prev => prev ? { ...prev, cover_image_path: null } : prev);
      showFeedback('Cover image removed');
    } catch (err) {
      console.error(err);
      showFeedback('Failed to remove cover image', true);
    }
  };

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
    profileChanged,
    profileSaved,

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
    colorsSaved,
    handleSaveColors,

    // Background image
    bgImageUrl,
    bgImageUploading,
    bgImageOverlayOpacity, setBgImageOverlayOpacity,
    handleBgImageUpload,
    handleBgImageRemove,

    // Cover image
    coverImageUrl,
    coverImageUploading,
    handleCoverImageUpload,
    handleCoverImageRemove,

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

    // Brand colors
    brandColors, setBrandColors,
    brandColorsSaved,
    brandColorsError,
  };
}
