// components/admin/company/useCompanyBrandColors.ts
'use client';

import { useState, useEffect } from 'react';
import { setBrandingColors } from '@/components/ui/ColorPickerField';
import { CompanySettingsContext, getAuthHeaders } from './useCompanySettingsTypes';

export function useCompanyBrandColors(ctx: CompanySettingsContext) {
  const { companyId, company, isOwner, setSaving, showFeedback, setCompany } = ctx;

  const [brandColors, setBrandColors]           = useState<string[]>([]);
  const [brandColorsSaved, setBrandColorsSaved] = useState(false);
  const [brandColorsError, setBrandColorsError] = useState<string | null>(null);

  // Sync from fetched company
  useEffect(() => {
    if (!company) return;
    const palette: string[] = Array.isArray(company.brand_colors) ? company.brand_colors : [];
    setBrandColors(palette);
    setBrandingColors(palette);
  }, [company]);

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

  return {
    brandColors, setBrandColors,
    brandColorsSaved,
    brandColorsError,
  };
}
