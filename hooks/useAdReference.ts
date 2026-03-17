// hooks/useAdReference.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, AdAngleFamily, AdCreativeFormat } from '@/lib/supabase';

export function useAdReference(companyId: string | null) {
  const [angleFamilies, setAngleFamilies] = useState<AdAngleFamily[]>([]);
  const [creativeFormats, setCreativeFormats] = useState<AdCreativeFormat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReference = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setLoading(false); return; }

    const headers = { Authorization: `Bearer ${token}` };
    const qs = `?company_id=${companyId}`;

    const [anglesRes, formatsRes] = await Promise.all([
      fetch(`/api/ads/reference/angle-families${qs}`, { headers }),
      fetch(`/api/ads/reference/creative-formats${qs}`, { headers }),
    ]);

    const [anglesJson, formatsJson] = await Promise.all([
      anglesRes.json(),
      formatsRes.json(),
    ]);

    setAngleFamilies(anglesJson.data || []);
    setCreativeFormats(formatsJson.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchReference();
  }, [fetchReference]);

  return { angleFamilies, creativeFormats, loading, fetchReference };
}
