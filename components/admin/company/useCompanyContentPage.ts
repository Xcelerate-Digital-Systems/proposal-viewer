// components/admin/company/useCompanyContentPage.ts
'use client';

import { useState, useEffect } from 'react';
import { isValidHex6 } from '@/lib/company-utils';
import { CompanySettingsContext, getAuthHeaders } from './useCompanySettingsTypes';

export function useCompanyContentPage(ctx: CompanySettingsContext) {
  const { companyId, company, isOwner, setSaving, showFeedback, setCompany } = ctx;

  const [textPageBgColor, setTextPageBgColor]           = useState('#141414');
  const [textPageTextColor, setTextPageTextColor]       = useState('#ffffff');
  const [textPageHeadingColor, setTextPageHeadingColor] = useState<string | null>(null);
  const [contentPageSaved, setContentPageSaved]         = useState(false);

  // Sync from fetched company
  useEffect(() => {
    if (!company) return;
    setTextPageBgColor(company.text_page_bg_color || '#141414');
    setTextPageTextColor(company.text_page_text_color || '#ffffff');
    setTextPageHeadingColor(company.text_page_heading_color || null);
  }, [company]);

  const handleSaveContentPage = async () => {
    if (!isOwner) return;
    setSaving('content_page');
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/company?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text_page_bg_color: textPageBgColor,
        text_page_text_color: textPageTextColor,
        text_page_heading_color: textPageHeadingColor,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFeedback(data.error || 'Failed to save', true);
    } else {
      setCompany(prev => prev ? { ...prev, ...data } : prev);
      setContentPageSaved(true);
      setTimeout(() => setContentPageSaved(false), 2000);
    }
    setSaving(null);
  };

  const contentPageChanged =
    textPageBgColor !== (company?.text_page_bg_color || '#141414') ||
    textPageTextColor !== (company?.text_page_text_color || '#ffffff') ||
    (textPageHeadingColor || null) !== (company?.text_page_heading_color || null);

  useEffect(() => {
    if (!contentPageChanged || !isOwner || !company) return;
    if (!isValidHex6(textPageBgColor) || !isValidHex6(textPageTextColor)) return;
    if (textPageHeadingColor && !isValidHex6(textPageHeadingColor)) return;
    const timer = setTimeout(() => handleSaveContentPage(), 800);
    return () => clearTimeout(timer);
  }, [textPageBgColor, textPageTextColor, textPageHeadingColor]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    textPageBgColor, setTextPageBgColor,
    textPageTextColor, setTextPageTextColor,
    textPageHeadingColor, setTextPageHeadingColor,
    contentPageChanged,
    contentPageSaved,
  };
}
