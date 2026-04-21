'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, type FeedbackItem, type FeedbackItemVersion } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { buildVersionList, getActiveVersion, type VersionView } from '@/lib/feedback/versions';

interface UseItemVersionsOptions {
  item: FeedbackItem | null;
  companyId: string;
  userId: string | null;
}

/**
 * Loads and manages versions for a single feedback item from the admin side.
 * v1 is synthesised from the item itself; v2+ come from `review_item_versions`.
 *
 * `activeVersionId === null` means "show v1". Any other value points at a
 * review_item_versions row id. The hook keeps local + DB state in sync so
 * reloads never snap the picker back to an older selection.
 */
export function useItemVersions({ item, companyId, userId }: UseItemVersionsOptions) {
  const toast = useToast();
  const [rows, setRows] = useState<FeedbackItemVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(item?.active_version_id ?? null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Keep the local active_version_id pointer aligned with the item prop.
  useEffect(() => {
    if (item) setActiveVersionId(item.active_version_id ?? null);
  }, [item?.id, item?.active_version_id]);

  const itemId = item?.id;

  const fetchVersions = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    const { data } = await supabase
      .from('review_item_versions')
      .select('*')
      .eq('review_item_id', itemId)
      .order('version_number', { ascending: true });
    setRows((data as FeedbackItemVersion[]) || []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    if (itemId) fetchVersions();
  }, [itemId, fetchVersions]);

  const versions = useMemo<VersionView[]>(
    () => (item ? buildVersionList(item, rows) : []),
    [item, rows]
  );

  const activeVersion = useMemo<VersionView | null>(
    () => (versions.length ? getActiveVersion(versions, activeVersionId) : null),
    [versions, activeVersionId]
  );

  const nextVersionNumber = useMemo(
    () => versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1,
    [versions]
  );

  const persistActiveVersion = useCallback(
    async (nextId: string | null) => {
      if (!itemId) return;
      setActiveVersionId(nextId);
      const { error } = await supabase
        .from('review_items')
        .update({ active_version_id: nextId, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to switch version');
      }
    },
    [itemId, toast]
  );

  /**
   * Create a new version row. Callers supply pre-resolved asset fields (after
   * any file upload has already happened) plus optional notes. Returns the
   * inserted row or null on failure. The new version is automatically made
   * active so the UI jumps to showing it.
   */
  const createVersion = useCallback(
    async (input: {
      notes?: string | null;
      assets: Partial<FeedbackItemVersion>;
    }) => {
      if (!itemId) return null;
      setCreating(true);
      const payload = {
        review_item_id: itemId,
        company_id: companyId,
        version_number: nextVersionNumber,
        notes: input.notes ?? null,
        created_by: userId,
        ...input.assets,
      };
      const { data, error } = await supabase
        .from('review_item_versions')
        .insert(payload)
        .select()
        .single();
      setCreating(false);
      if (error || !data) {
        toast.error('Failed to save version');
        return null;
      }
      const row = data as FeedbackItemVersion;
      setRows((prev) => [...prev, row]);
      await persistActiveVersion(row.id);
      toast.success(`Version ${row.version_number} added`);
      return row;
    },
    [itemId, companyId, userId, nextVersionNumber, persistActiveVersion, toast]
  );

  /** Upload a single file to storage and return its public URL. */
  const uploadAsset = useCallback(
    async (file: File): Promise<string | null> => {
      if (!itemId) return null;
      const ext = file.name.split('.').pop() || 'bin';
      const path = `reviews/${companyId}/versions/${itemId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error('Upload failed');
        return null;
      }
      return supabase.storage.from('company-assets').getPublicUrl(path).data.publicUrl;
    },
    [itemId, companyId, toast]
  );

  return {
    versions,
    activeVersion,
    activeVersionId,
    loading,
    creating,
    setActiveVersion: persistActiveVersion,
    createVersion,
    uploadAsset,
    refreshVersions: fetchVersions,
  };
}
