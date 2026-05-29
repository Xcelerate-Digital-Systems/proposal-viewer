// hooks/useCompanyBranding.ts
// Fetches the parent AGENCY's branding for client accounts so the admin
// sidebar can be white-labelled. Client companies have an `agency_id` FK
// pointing to their parent agency — we fetch that agency's branding, not
// the client's own.

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface SidebarBranding {
  logoUrl: string | null;
  bgPrimary: string;
  bgSecondary: string;
  accentColor: string;
  sidebarTextColor: string;
  companyName: string;
}

export function useCompanyBranding(
  companyId: string | null,
  accountType: 'agency' | 'client',
): SidebarBranding | null {
  const [branding, setBranding] = useState<SidebarBranding | null>(null);

  useEffect(() => {
    if (!companyId || accountType !== 'client') {
      setBranding(null);
      return;
    }

    let cancelled = false;

    (async () => {
      // Look up the parent agency for this client company.
      const { data: clientCompany } = await supabase
        .from('companies')
        .select('agency_id')
        .eq('id', companyId)
        .single();

      if (cancelled) return;
      const agencyId = clientCompany?.agency_id;
      if (!agencyId) return;

      const res = await fetch(`/api/company/branding?company_id=${agencyId}`);
      if (cancelled || !res.ok) return;
      const data = await res.json();
      if (cancelled) return;

      setBranding({
        logoUrl: data.logo_url || null,
        bgPrimary: data.bg_primary || '#0f0f0f',
        bgSecondary: data.bg_secondary || '#141414',
        accentColor: data.accent_color || '#01434A',
        sidebarTextColor: data.sidebar_text_color || '#ffffff',
        companyName: data.name || '',
      });
    })();

    return () => { cancelled = true; };
  }, [companyId, accountType]);

  return branding;
}
