// hooks/useCompanyBranding.ts
// Fetches the parent AGENCY's branding for client accounts so the admin
// sidebar can be white-labelled. Client companies have an `agency_id` FK
// pointing to their parent agency — we fetch that agency's branding, not
// the client's own.

'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { generateBrandPalette, type BrandPalette } from '@/lib/branding';

export interface SidebarBranding {
  logoUrl: string | null;
  bgPrimary: string;
  bgSecondary: string;
  bgDivider: string | null;
  accentColor: string;
  sidebarTextColor: string;
  sidebarInactiveTextColor: string | null;
  companyName: string;
  palette: BrandPalette;
}

export function useCompanyBranding(
  companyId: string | null,
  accountType: 'agency' | 'client',
): { branding: SidebarBranding | null; loading: boolean } {
  const [raw, setRaw] = useState<Omit<SidebarBranding, 'palette'> | null>(null);
  const [loading, setLoading] = useState(accountType === 'client' && !!companyId);

  useEffect(() => {
    if (!companyId || accountType !== 'client') {
      setRaw(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    (async () => {
      const { data: clientCompany } = await supabase
        .from('companies')
        .select('agency_id')
        .eq('id', companyId)
        .single();

      if (cancelled) return;
      const agencyId = clientCompany?.agency_id;
      if (!agencyId) {
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/company/branding?company_id=${agencyId}`);
      if (cancelled) return;
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;

      setRaw({
        logoUrl: data.logo_url || null,
        bgPrimary: data.bg_primary || '#0f0f0f',
        bgSecondary: data.bg_secondary || '#141414',
        bgDivider: data.bg_divider || null,
        accentColor: data.accent_color || '#01434A',
        sidebarTextColor: data.sidebar_text_color || '#ffffff',
        sidebarInactiveTextColor: data.sidebar_inactive_text_color || null,
        companyName: data.name || '',
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [companyId, accountType]);

  const branding = useMemo(() => {
    if (!raw) return null;
    return {
      ...raw,
      palette: generateBrandPalette(raw.accentColor, raw.bgPrimary, raw.bgSecondary, raw.sidebarTextColor, undefined, raw.bgDivider, raw.sidebarInactiveTextColor),
    };
  }, [raw]);

  return { branding, loading };
}
