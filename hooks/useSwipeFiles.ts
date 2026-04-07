// hooks/useSwipeFiles.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  SwipeFile,
  SwipeType,
  SwipeTypeWithCount,
} from '@/lib/supabase';

async function authHeaders() {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export function useSwipeFiles(companyId: string | null) {
  const [types, setTypes] = useState<SwipeTypeWithCount[]>([]);
  const [filesByType, setFilesByType] = useState<Record<string, SwipeFile[]>>({});
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllTags = useCallback(async () => {
    if (!companyId) return;
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(`/api/ads/swipe/tags?company_id=${companyId}`, { headers });
    const json = await res.json();
    if (res.ok) setAllTags(json.data || []);
  }, [companyId]);

  const fetchTypes = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) { setLoading(false); return; }

    const res = await fetch(`/api/ads/swipe/types?company_id=${companyId}`, { headers });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to fetch types');
      setLoading(false);
      return;
    }
    setTypes(json.data || []);
    setLoading(false);
  }, [companyId]);

  const fetchFilesForType = useCallback(async (typeId: string) => {
    if (!companyId) return;
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/ads/swipe/files?company_id=${companyId}&type_id=${typeId}`,
      { headers }
    );
    const json = await res.json();
    if (res.ok) {
      setFilesByType((prev) => ({ ...prev, [typeId]: json.data || [] }));
    }
  }, [companyId]);

  useEffect(() => { fetchTypes(); fetchAllTags(); }, [fetchTypes, fetchAllTags]);

  /* ─── Types ─── */
  const createType = async (data: { name: string; description?: string }) => {
    const headers = await authHeaders();
    if (!headers) return { error: 'Not authenticated' };
    const res = await fetch(`/api/ads/swipe/types?company_id=${companyId}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    await fetchTypes();
    return { data: json.data as SwipeType };
  };

  const updateType = async (id: string, data: Partial<SwipeType>) => {
    const headers = await authHeaders();
    if (!headers) return { error: 'Not authenticated' };
    const res = await fetch(`/api/ads/swipe/types/${id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    await fetchTypes();
    return { data: json.data };
  };

  const deleteType = async (id: string) => {
    const headers = await authHeaders();
    if (!headers) return { error: 'Not authenticated' };
    const res = await fetch(`/api/ads/swipe/types/${id}?company_id=${companyId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const json = await res.json();
      return { error: json.error };
    }
    await fetchTypes();
    return {};
  };

  /* ─── Files ─── */
  const createFile = async (data: Partial<SwipeFile> & { type_id: string; title: string }) => {
    const headers = await authHeaders();
    if (!headers) return { error: 'Not authenticated' };
    const res = await fetch(`/api/ads/swipe/files?company_id=${companyId}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    await fetchFilesForType(data.type_id);
    await fetchTypes(); // refresh counts
    await fetchAllTags();
    return { data: json.data as SwipeFile };
  };

  const updateFile = async (id: string, typeId: string, data: Partial<SwipeFile>) => {
    const headers = await authHeaders();
    if (!headers) return { error: 'Not authenticated' };
    const res = await fetch(`/api/ads/swipe/files/${id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    await fetchFilesForType(typeId);
    await fetchAllTags();
    return { data: json.data };
  };

  const deleteFile = async (id: string, typeId: string) => {
    const headers = await authHeaders();
    if (!headers) return { error: 'Not authenticated' };
    const res = await fetch(`/api/ads/swipe/files/${id}?company_id=${companyId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const json = await res.json();
      return { error: json.error };
    }
    await fetchFilesForType(typeId);
    await fetchTypes();
    return {};
  };

  const uploadMedia = async (file: File, swipeId?: string) => {
    const headers = await authHeaders();
    if (!headers || !companyId) return { error: 'Not authenticated' };
    const fd = new FormData();
    fd.append('file', file);
    fd.append('company_id', companyId);
    if (swipeId) fd.append('swipe_id', swipeId);

    const res = await fetch(`/api/ads/swipe/files/upload?company_id=${companyId}`, {
      method: 'POST',
      headers,
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return { url: json.url as string, media_type: json.media_type as 'image' | 'video' };
  };

  return {
    types,
    filesByType,
    allTags,
    loading,
    error,
    fetchTypes,
    fetchFilesForType,
    fetchAllTags,
    createType, updateType, deleteType,
    createFile, updateFile, deleteFile,
    uploadMedia,
  };
}
