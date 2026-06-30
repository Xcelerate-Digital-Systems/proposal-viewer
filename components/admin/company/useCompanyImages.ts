// components/admin/company/useCompanyImages.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { CompanySettingsContext, getAuthHeaders } from './useCompanySettingsTypes';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export function useCompanyImages(ctx: CompanySettingsContext) {
  const { companyId, company, isOwner, showFeedback, setCompany } = ctx;
  const confirm = useConfirm();

  // Background image
  const [bgImagePath, setBgImagePath]                     = useState<string | null>(null);
  const [bgImageUrl, setBgImageUrl]                       = useState<string | null>(null);
  const [bgImageUploading, setBgImageUploading]           = useState(false);

  // Cover image
  const [coverImagePath, setCoverImagePath]         = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl]           = useState<string | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from fetched company
  useEffect(() => {
    if (!company) return;
    setBgImagePath(company.bg_image_path || null);
    setCoverImagePath(company.cover_image_path || null);

    if (company.bg_image_path) {
      const { data: bgUrl } = supabase.storage
        .from('company-assets')
        .getPublicUrl(company.bg_image_path);
      setBgImageUrl(bgUrl?.publicUrl || null);
    } else {
      setBgImageUrl(null);
    }

    if (company.cover_image_path) {
      const { data: coverUrl } = supabase.storage
        .from('company-assets')
        .getPublicUrl(company.cover_image_path);
      setCoverImageUrl(coverUrl?.publicUrl || null);
    } else {
      setCoverImageUrl(null);
    }
  }, [company]);

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
    const ok = await confirm({ title: 'Remove logo', message: 'Remove company logo?', confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
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
    if (file.size > MAX_IMAGE_SIZE) {
      showFeedback('Image must be under 5 MB', true);
      return;
    }
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
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showFeedback(`Upload failed: ${msg}`, true);
    } finally {
      setBgImageUploading(false);
    }
  };

  const handleBgImageRemove = async () => {
    if (!isOwner || !bgImagePath) return;
    const ok = await confirm({ title: 'Remove background image', message: 'Remove the background texture from your viewer?', confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
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

  /* ── Cover image ───────────────────────────────────────────── */

  const handleCoverImageUpload = async (file: File) => {
    if (!isOwner) return;
    if (file.size > MAX_IMAGE_SIZE) {
      showFeedback('Image must be under 5 MB', true);
      return;
    }
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
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showFeedback(`Upload failed: ${msg}`, true);
    } finally {
      setCoverImageUploading(false);
    }
  };

  const handleCoverImageRemove = async () => {
    if (!isOwner || !coverImagePath) return;
    const ok = await confirm({ title: 'Remove cover image', message: 'Remove the default cover image? New proposals will use a plain background.', confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
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
    // Logo
    logoUploading,
    fileInputRef,
    handleLogoUpload,
    handleLogoRemove,

    // Background image
    bgImageUrl,
    bgImageUploading,
    handleBgImageUpload,
    handleBgImageRemove,

    // Cover image
    coverImageUrl,
    coverImageUploading,
    handleCoverImageUpload,
    handleCoverImageRemove,
  };
}
