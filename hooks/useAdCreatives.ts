// hooks/useAdCreatives.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, AdCreativeWithVariants } from '@/lib/supabase';

export type AdCreativeFilters = {
  tracker_id?: string;
  client_id?: string;
  status?: string;
  winner?: string;
  media_type?: string;
  awareness_level?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
};

export type Pagination = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
};

export function useAdCreatives(companyId: string | null, filters: AdCreativeFilters) {
  const [creatives, setCreatives] = useState<AdCreativeWithVariants[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 100, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreatives = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setLoading(false); return; }

    const params = new URLSearchParams();
    params.set('company_id', companyId);
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== '') params.set(key, String(val));
    });

    const res = await fetch(`/api/ads/creatives?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to fetch creatives');
      setLoading(false);
      return;
    }

    setCreatives(json.data || []);
    setPagination(json.pagination || { page: 1, per_page: 100, total: 0, total_pages: 0 });
    setLoading(false);
  }, [companyId, filters]);

  useEffect(() => {
    fetchCreatives();
  }, [fetchCreatives]);

  const createCreative = async (data: Record<string, unknown>) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/creatives?company_id=${companyId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) return { error: json.error };

    await fetchCreatives();
    return { data: json.data };
  };

  const updateCreative = async (id: string, data: Record<string, unknown>) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/creatives/${id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) return { error: json.error };

    // Update local state immediately
    setCreatives(prev => prev.map(c => c.id === id ? json.data : c));
    return { data: json.data };
  };

  const deleteCreative = async (id: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/creatives/${id}?company_id=${companyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const json = await res.json();
      return { error: json.error };
    }

    setCreatives(prev => prev.filter(c => c.id !== id));
    return {};
  };

  const bulkUpdate = async (ids: string[], updates: Record<string, unknown>) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { error: 'Not authenticated' };

    const res = await fetch(`/api/ads/creatives/bulk?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates }),
    });

    const json = await res.json();
    if (!res.ok) return { error: json.error };

    await fetchCreatives();
    return { data: json.data };
  };

  return {
    creatives, pagination, loading, error,
    fetchCreatives, createCreative, updateCreative, deleteCreative, bulkUpdate,
  };
}
