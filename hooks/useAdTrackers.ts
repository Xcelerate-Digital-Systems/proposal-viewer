// hooks/useAdTrackers.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, AdTracker, AdTrackerWithCount } from '@/lib/supabase';

export function useAdTrackers(companyId: string | null) {
  const [trackers, setTrackers] = useState<AdTrackerWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackers = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setLoading(false); return; }

    const res = await fetch(`/api/ads/trackers?company_id=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to fetch trackers');
      setLoading(false);
      return;
    }

    setTrackers(json.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchTrackers();
  }, [fetchTrackers]);

  const createTracker = async (data: { name: string; description?: string; client_id?: string; client_name?: string }) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/trackers?company_id=${companyId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) return { error: json.error };

    await fetchTrackers();
    return { data: json.data };
  };

  const updateTracker = async (id: string, data: Partial<AdTracker>) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/trackers/${id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) return { error: json.error };

    await fetchTrackers();
    return { data: json.data };
  };

  const deleteTracker = async (id: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/trackers/${id}?company_id=${companyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const json = await res.json();
      return { error: json.error };
    }

    await fetchTrackers();
    return {};
  };

  return { trackers, loading, error, fetchTrackers, createTracker, updateTracker, deleteTracker };
}
