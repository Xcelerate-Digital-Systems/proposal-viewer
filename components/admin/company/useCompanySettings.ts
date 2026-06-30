// components/admin/company/useCompanySettings.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { CompanyData } from '@/lib/company-utils';
import { getAuthHeaders } from './useCompanySettingsTypes';
import { useCompanyProfile } from './useCompanyProfile';
import { useCompanySidebarColors } from './useCompanySidebarColors';
import { useCompanyContentPage } from './useCompanyContentPage';
import { useCompanyDecisionDesign } from './useCompanyDecisionDesign';
import { useCompanyFonts } from './useCompanyFonts';
import { useCompanyBrandColors } from './useCompanyBrandColors';
import { useCompanyImages } from './useCompanyImages';

export function useCompanySettings(companyId: string) {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const isOwner = company?.current_role === 'owner';

  /* ── Feedback ──────────────────────────────────────────────── */

  const showFeedback = useCallback((msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  }, []);

  /* ── Fetch ─────────────────────────────────────────────────── */

  const fetchCompany = useCallback(async () => {
    if (!companyId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/company?company_id=${companyId}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setCompany(data);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchCompany();
  }, [fetchCompany]);

  /* ── Shared context ────────────────────────────────────────── */

  const ctx = {
    companyId,
    company,
    isOwner,
    saving,
    setSaving,
    showFeedback,
    setCompany,
  };

  /* ── Sub-hooks ─────────────────────────────────────────────── */

  const profile = useCompanyProfile(ctx);
  const contentPage = useCompanyContentPage(ctx);
  const sidebarColors = useCompanySidebarColors(ctx, {
    setTextPageBgColor: contentPage.setTextPageBgColor,
    setTextPageTextColor: contentPage.setTextPageTextColor,
    setTextPageHeadingColor: contentPage.setTextPageHeadingColor,
  });
  const decisionDesign = useCompanyDecisionDesign(ctx);
  const fonts = useCompanyFonts(ctx);
  const brandColors = useCompanyBrandColors(ctx);
  const images = useCompanyImages(ctx);

  return {
    // Core
    company,
    loading,
    saving,
    error,
    success,
    isOwner,

    // Profile
    name: profile.name, setName: profile.setName,
    slug: profile.slug, setSlug: profile.setSlug,
    website: profile.website, setWebsite: profile.setWebsite,
    profileChanged: profile.profileChanged,
    profileSaved: profile.profileSaved,

    // Logo
    logoUploading: images.logoUploading,
    fileInputRef: images.fileInputRef,
    handleLogoUpload: images.handleLogoUpload,
    handleLogoRemove: images.handleLogoRemove,

    // Colors
    accentColor: sidebarColors.accentColor, setAccentColor: sidebarColors.setAccentColor,
    bgPrimary: sidebarColors.bgPrimary, setBgPrimary: sidebarColors.setBgPrimary,
    bgSecondary: sidebarColors.bgSecondary, setBgSecondary: sidebarColors.setBgSecondary,
    bgDivider: sidebarColors.bgDivider, setBgDivider: sidebarColors.setBgDivider,
    sidebarTextColor: sidebarColors.sidebarTextColor, setSidebarTextColor: sidebarColors.setSidebarTextColor,
    sidebarInactiveTextColor: sidebarColors.sidebarInactiveTextColor, setSidebarInactiveTextColor: sidebarColors.setSidebarInactiveTextColor,
    acceptTextColor: sidebarColors.acceptTextColor, setAcceptTextColor: sidebarColors.setAcceptTextColor,
    colorsChanged: sidebarColors.colorsChanged,
    colorsSaved: sidebarColors.colorsSaved,
    handleSaveColors: sidebarColors.handleSaveColors,

    // Background image
    bgImageUrl: images.bgImageUrl,
    bgImageUploading: images.bgImageUploading,
    bgImageOverlayOpacity: sidebarColors.bgImageOverlayOpacity, setBgImageOverlayOpacity: sidebarColors.setBgImageOverlayOpacity,
    handleBgImageUpload: images.handleBgImageUpload,
    handleBgImageRemove: images.handleBgImageRemove,

    // Cover image
    coverImageUrl: images.coverImageUrl,
    coverImageUploading: images.coverImageUploading,
    handleCoverImageUpload: images.handleCoverImageUpload,
    handleCoverImageRemove: images.handleCoverImageRemove,

    // Fonts
    fontHeading: fonts.fontHeading, setFontHeading: fonts.setFontHeading,
    fontBody: fonts.fontBody, setFontBody: fonts.setFontBody,
    fontSidebar: fonts.fontSidebar, setFontSidebar: fonts.setFontSidebar,
    fontHeadingWeight: fonts.fontHeadingWeight, setFontHeadingWeight: fonts.setFontHeadingWeight,
    fontBodyWeight: fonts.fontBodyWeight, setFontBodyWeight: fonts.setFontBodyWeight,
    fontSidebarWeight: fonts.fontSidebarWeight, setFontSidebarWeight: fonts.setFontSidebarWeight,
    fontsChanged: fonts.fontsChanged,
    fontsSaved: fonts.fontsSaved,
    handleSaveFonts: fonts.handleSaveFonts,

    // Content page defaults
    textPageBgColor: contentPage.textPageBgColor, setTextPageBgColor: contentPage.setTextPageBgColor,
    textPageTextColor: contentPage.textPageTextColor, setTextPageTextColor: contentPage.setTextPageTextColor,
    textPageHeadingColor: contentPage.textPageHeadingColor, setTextPageHeadingColor: contentPage.setTextPageHeadingColor,
    contentPageChanged: contentPage.contentPageChanged,
    contentPageSaved: contentPage.contentPageSaved,

    // Decision design
    decisionBgColor: decisionDesign.decisionBgColor, setDecisionBgColor: decisionDesign.setDecisionBgColor,
    decisionTextColor: decisionDesign.decisionTextColor, setDecisionTextColor: decisionDesign.setDecisionTextColor,
    decisionHeadingColor: decisionDesign.decisionHeadingColor, setDecisionHeadingColor: decisionDesign.setDecisionHeadingColor,
    decisionAcceptButtonColor: decisionDesign.decisionAcceptButtonColor, setDecisionAcceptButtonColor: decisionDesign.setDecisionAcceptButtonColor,
    decisionDeclineButtonColor: decisionDesign.decisionDeclineButtonColor, setDecisionDeclineButtonColor: decisionDesign.setDecisionDeclineButtonColor,
    decisionRevisionButtonColor: decisionDesign.decisionRevisionButtonColor, setDecisionRevisionButtonColor: decisionDesign.setDecisionRevisionButtonColor,
    decisionCheckboxColor: decisionDesign.decisionCheckboxColor, setDecisionCheckboxColor: decisionDesign.setDecisionCheckboxColor,
    decisionDesignChanged: decisionDesign.decisionDesignChanged,
    decisionDesignSaved: decisionDesign.decisionDesignSaved,

    // Brand colors
    brandColors: brandColors.brandColors, setBrandColors: brandColors.setBrandColors,
    brandColorsSaved: brandColors.brandColorsSaved,
    brandColorsError: brandColors.brandColorsError,
  };
}
