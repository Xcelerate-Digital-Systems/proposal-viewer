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

export type ShareTarget = { id: string; name: string };

export function useSwipeFiles(companyId: string | null) {
  const [types, setTypes] = useState<SwipeTypeWithCount[]>([]);
  const [filesByType, setFilesByType] = useState<Record<string, SwipeFile[]>>({});
  const [allTags, setAllTags] = useState<string[]>([]);
  const [shareTargets, setShareTargets] = useState<ShareTarget[]>([]);
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

  const fetchShareTargets = useCallback(async () => {
    if (!companyId) return;
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(`/api/share-targets?company_id=${companyId}`, { headers });
    const json = await res.json();
    if (res.ok) setShareTargets(json.data || []);
  }, [companyId]);

  useEffect(() => {
    fetchTypes();
    fetchAllTags();
    fetchShareTargets();
  }, [fetchTypes, fetchAllTags, fetchShareTargets]);

  /* ─── Types ─── */
  const createType = async (data: { name: string; description?: string; shared_with_company_ids?: string[] }) => {
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

  /**
   * Two-step upload to avoid Vercel's ~4.5MB serverless body limit:
   *   1. Ask the API for a signed upload URL (tiny JSON request)
   *   2. Stream the file directly to Supabase Storage from the browser
   */
  const uploadMedia = async (file: File, swipeId?: string) => {
    const headers = await authHeaders();
    if (!headers || !companyId) return { error: 'Not authenticated' };

    // Client-side guard (server + bucket enforce 100MB too)
    if (file.size > 100 * 1024 * 1024) {
      return { error: 'File too large (max 100MB)' };
    }

    // Step 1: request a signed upload URL
    const signRes = await fetch(`/api/ads/swipe/files/upload?company_id=${companyId}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type,
        company_id: companyId,
        swipe_id: swipeId,
      }),
    });
    const signJson = await signRes.json();
    if (!signRes.ok) return { error: signJson.error || 'Failed to prepare upload' };

    // Step 2: upload the file bytes directly to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .uploadToSignedUrl(signJson.path, signJson.token, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Direct upload error:', uploadError);
      return { error: uploadError.message || 'Upload failed' };
    }

    return {
      url: signJson.public_url as string,
      media_type: signJson.media_type as 'image' | 'video',
    };
  };

  return {
    companyId,
    types,
    filesByType,
    allTags,
    shareTargets,
    loading,
    error,
    fetchTypes,
    fetchFilesForType,
    fetchAllTags,
    fetchShareTargets,
    createType, updateType, deleteType,
    createFile, updateFile, deleteFile,
    uploadMedia,
  };
}
