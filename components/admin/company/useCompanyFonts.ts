// components/admin/company/useCompanyFonts.ts
'use client';

import { useState, useEffect } from 'react';
import { CompanySettingsContext, getAuthHeaders } from './useCompanySettingsTypes';

export function useCompanyFonts(ctx: CompanySettingsContext) {
  const { companyId, company, isOwner, setSaving, showFeedback, setCompany } = ctx;

  const [fontHeading, setFontHeading]             = useState<string | null>(null);
  const [fontBody, setFontBody]                   = useState<string | null>(null);
  const [fontSidebar, setFontSidebar]             = useState<string | null>(null);
  const [fontHeadingWeight, setFontHeadingWeight] = useState<string | null>(null);
  const [fontBodyWeight, setFontBodyWeight]       = useState<string | null>(null);
  const [fontSidebarWeight, setFontSidebarWeight] = useState<string | null>(null);
  const [fontsSaved, setFontsSaved]               = useState(false);

  // Sync from fetched company
  useEffect(() => {
    if (!company) return;
    setFontHeading(company.font_heading || null);
    setFontBody(company.font_body || null);
    setFontSidebar(company.font_sidebar || null);
    setFontHeadingWeight(company.font_heading_weight || null);
    setFontBodyWeight(company.font_body_weight || null);
    setFontSidebarWeight(company.font_sidebar_weight || null);
  }, [company]);

  const handleSaveFonts = async () => {
    if (!isOwner) return;
    setSaving('fonts');
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

  return {
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
