// components/admin/company/useCompanySidebarColors.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import { isValidHex6 } from '@/lib/company-utils';
import { hexToOklch } from '@/lib/branding/color-math';
import { CompanySettingsContext, getAuthHeaders } from './useCompanySettingsTypes';

export function useCompanySidebarColors(
  ctx: CompanySettingsContext,
  /** Setters from contentPage hook for auto-contrast sync */
  contentPageSetters?: {
    setTextPageBgColor: (v: string) => void;
    setTextPageTextColor: (v: string) => void;
    setTextPageHeadingColor: (v: string | null) => void;
  },
) {
  const { companyId, company, isOwner, setSaving, showFeedback, setCompany } = ctx;

  const [accentColor, setAccentColor]           = useState('#01434A');
  const [bgPrimary, setBgPrimary]               = useState('#0f0f0f');
  const [bgSecondary, setBgSecondary]           = useState('#141414');
  const [bgDivider, setBgDivider]               = useState<string | null>(null);
  const [sidebarTextColor, setSidebarTextColor] = useState('#ffffff');
  const [sidebarInactiveTextColor, setSidebarInactiveTextColor] = useState<string | null>(null);
  const [acceptTextColor, setAcceptTextColor]   = useState('#ffffff');
  const [bgImageOverlayOpacity, setBgImageOverlayOpacity] = useState(0.85);
  const [colorsSaved, setColorsSaved]           = useState(false);

  // Sync from fetched company
  useEffect(() => {
    if (!company) return;
    setAccentColor(company.accent_color || '#01434A');
    setBgPrimary(company.bg_primary || '#0f0f0f');
    setBgSecondary(company.bg_secondary || '#141414');
    setBgDivider(company.bg_divider || null);
    setSidebarTextColor(company.sidebar_text_color || '#ffffff');
    setSidebarInactiveTextColor(company.sidebar_inactive_text_color || null);
    setAcceptTextColor(company.accept_text_color || '#ffffff');
    setBgImageOverlayOpacity(company.bg_image_overlay_opacity ?? 0.85);
  }, [company]);

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
        bg_divider: bgDivider,
        sidebar_text_color: sidebarTextColor,
        sidebar_inactive_text_color: sidebarInactiveTextColor,
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

  const colorsChanged =
    accentColor !== (company?.accent_color || '#01434A') ||
    bgPrimary !== (company?.bg_primary || '#0f0f0f') ||
    bgSecondary !== (company?.bg_secondary || '#141414') ||
    bgDivider !== (company?.bg_divider || null) ||
    sidebarTextColor !== (company?.sidebar_text_color || '#ffffff') ||
    (sidebarInactiveTextColor || null) !== (company?.sidebar_inactive_text_color || null) ||
    acceptTextColor !== (company?.accept_text_color || '#ffffff') ||
    bgImageOverlayOpacity !== (company?.bg_image_overlay_opacity ?? 0.85);

  useEffect(() => {
    if (!colorsChanged || !isOwner || !company) return;
    if (
      !isValidHex6(accentColor) ||
      !isValidHex6(bgPrimary) ||
      !isValidHex6(bgSecondary) ||
      (bgDivider !== null && !isValidHex6(bgDivider)) ||
      !isValidHex6(sidebarTextColor) ||
      (sidebarInactiveTextColor !== null && !isValidHex6(sidebarInactiveTextColor)) ||
      !isValidHex6(acceptTextColor)
    ) return;
    const timer = setTimeout(() => {
      handleSaveColors();
    }, 800);
    return () => clearTimeout(timer);
  }, [accentColor, bgPrimary, bgSecondary, bgDivider, sidebarTextColor, sidebarInactiveTextColor, acceptTextColor, bgImageOverlayOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-contrast: when bgPrimary crosses the dark/light threshold,
  // flip text colors so they remain readable.
  const prevIsDark = useRef<boolean | null>(null);
  useEffect(() => {
    if (!isOwner || !company || !isValidHex6(bgPrimary)) return;
    const isDark = hexToOklch(bgPrimary).L < 0.5;
    if (prevIsDark.current !== null && prevIsDark.current !== isDark) {
      if (isDark) {
        setSidebarTextColor('#ffffff');
        setSidebarInactiveTextColor(null);
        setAcceptTextColor('#ffffff');
        contentPageSetters?.setTextPageBgColor('#141414');
        contentPageSetters?.setTextPageTextColor('#ffffff');
        contentPageSetters?.setTextPageHeadingColor(null);
      } else {
        setSidebarTextColor('#1a1a1a');
        setSidebarInactiveTextColor(null);
        setAcceptTextColor('#ffffff');
        contentPageSetters?.setTextPageBgColor('#ffffff');
        contentPageSetters?.setTextPageTextColor('#1a1a1a');
        contentPageSetters?.setTextPageHeadingColor(null);
      }
      showFeedback('Text colours adjusted for ' + (isDark ? 'dark' : 'light') + ' theme');
    }
    prevIsDark.current = isDark;
  }, [bgPrimary]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    accentColor, setAccentColor,
    bgPrimary, setBgPrimary,
    bgSecondary, setBgSecondary,
    bgDivider, setBgDivider,
    sidebarTextColor, setSidebarTextColor,
    sidebarInactiveTextColor, setSidebarInactiveTextColor,
    acceptTextColor, setAcceptTextColor,
    bgImageOverlayOpacity, setBgImageOverlayOpacity,
    colorsChanged,
    colorsSaved,
    handleSaveColors,
  };
}
