// components/admin/company/useCompanyProfile.ts
'use client';

import { useState, useEffect } from 'react';
import { CompanySettingsContext, getAuthHeaders } from './useCompanySettingsTypes';

export function useCompanyProfile(ctx: CompanySettingsContext) {
  const { companyId, company, isOwner, setSaving, showFeedback, setCompany } = ctx;

  const [name, setName]       = useState('');
  const [slug, setSlug]       = useState('');
  const [website, setWebsite] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Sync from fetched company
  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setSlug(company.slug);
    setWebsite(company.website || '');
  }, [company]);

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

  // Autosave profile fields (debounced)
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

  return {
    name, setName,
    slug, setSlug,
    website, setWebsite,
    profileChanged,
    profileSaved,
    handleSaveField,
  };
}
