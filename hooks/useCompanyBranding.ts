// hooks/useCompanyBranding.ts
// Fetches company branding for the admin sidebar (used by client accounts
// to display their parent agency's branding).

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
      const res = await fetch(`/api/company/branding?company_id=${companyId}`);
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
