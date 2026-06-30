'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, type FeedbackItem, type FeedbackItemVersion } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { buildVersionList, getActiveVersion, type VersionView } from '@/lib/feedback/versions';
import type { FeedbackStatus } from '@/lib/types/feedback';

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
   *
   * `resetToStage` mirrors Filestage's "send for review on upload" behaviour:
   * when set, the parent item's status is bumped to that stage after the
   * version is saved. Notify fans out to whichever stage the item lands in
   * (so the right reviewer cohort gets the new-version ping). Pass `null` to
   * leave the item's status untouched.
   */
  const createVersion = useCallback(
    async (input: {
      notes?: string | null;
      assets: Partial<FeedbackItemVersion>;
      resetToStage?: FeedbackStatus | null;
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
      if (error || !data) {
        setCreating(false);
        toast.error('Failed to save version');
        return null;
      }
      const row = data as FeedbackItemVersion;
      setRows((prev) => [...prev, row]);

      // Build a single combined update: set the active version, mirror
      // asset fields so list-view thumbnails reflect the new version,
      // bump the version counter, and optionally reset the stage.
      const itemUpdate: Record<string, unknown> = {
        active_version_id: row.id,
        version: nextVersionNumber,
        updated_at: new Date().toISOString(),
      };

      const MIRROR_FIELDS: (keyof FeedbackItemVersion)[] = [
        'image_url', 'ad_creative_url', 'video_url', 'pdf_url',
        'email_subject', 'email_preheader', 'email_body', 'sms_body',
        'ad_headline', 'ad_copy', 'ad_cta', 'ad_platform', 'meta_ad_variants',
        'google_ad_data', 'meta_lead_form_data',
      ];
      for (const key of MIRROR_FIELDS) {
        const val = input.assets[key as keyof typeof input.assets];
        if (val !== null && val !== undefined) {
          itemUpdate[key] = val;
        }
      }

      if (input.resetToStage && item && input.resetToStage !== item.status) {
        itemUpdate.status = input.resetToStage;
      }

      setActiveVersionId(row.id);
      const { error: updateErr } = await supabase
        .from('review_items')
        .update(itemUpdate)
        .eq('id', itemId);
      if (updateErr) {
        toast.error('Version saved, but failed to update the item preview');
      }

      // Clear prior approval votes so the new version doesn't auto-advance
      // from stale votes. When resetting to a specific stage, clear that
      // stage's decisions. When keeping the current stage, clear decisions
      // for the item's current stage (new content still needs fresh review).
      const stageToClear = input.resetToStage ?? item?.status;
      if (stageToClear) {
        await supabase
          .from('review_item_decisions')
          .delete()
          .eq('review_item_id', itemId)
          .eq('stage', stageToClear);
      }

      setCreating(false);
      toast.success(`Version ${row.version_number} added`);

      // Fire "ready for review" notifications: assignees + project client +
      // anyone who's previously commented on this item. Best-effort; we don't
      // surface failures since the version itself is saved.
      void notifyNewVersion({
        item,
        version: row,
        userId,
        companyId,
      });

      return row;
    },
    [itemId, companyId, userId, nextVersionNumber, persistActiveVersion, toast, item]
  );

  /**
   * Edit an existing version's assets and notes. v1 (id === null) writes
   * back to review_items; v2+ updates the matching review_item_versions row.
   */
  const updateVersion = useCallback(
    async (
      versionId: string | null,
      patch: { notes?: string | null; assets: Partial<FeedbackItemVersion> }
    ): Promise<boolean> => {
      if (!itemId) return false;

      if (versionId === null) {
        // v1 lives on the review_items row itself — no `notes` column,
        // but it has `updated_at`.
        const { error } = await supabase
          .from('review_items')
          .update({ ...patch.assets, updated_at: new Date().toISOString() })
          .eq('id', itemId);
        if (error) {
          toast.error('Failed to update version');
          return false;
        }
      } else {
        // review_item_versions has `notes` but no `updated_at` column.
        const versionUpdates: Record<string, unknown> = { ...patch.assets };
        if (patch.notes !== undefined) versionUpdates.notes = patch.notes;
        const { data, error } = await supabase
          .from('review_item_versions')
          .update(versionUpdates)
          .eq('id', versionId)
          .select()
          .single();
        if (error || !data) {
          toast.error('Failed to update version');
          return false;
        }
        setRows((prev) => prev.map((r) => (r.id === versionId ? (data as FeedbackItemVersion) : r)));
      }
      toast.success('Version updated');
      return true;
    },
    [itemId, toast]
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
    updateVersion,
    uploadAsset,
    refreshVersions: fetchVersions,
  };
}

async function notifyNewVersion(params: {
  item: FeedbackItem | null;
  version: FeedbackItemVersion;
  userId: string | null;
  companyId: string;
}) {
  const { item, userId, companyId } = params;
  if (!item) return;

  // Look up the project's share_token + the uploader's display name so the
  // email reads naturally. Both are best-effort.
  const [{ data: project }, { data: member }] = await Promise.all([
    supabase
      .from('review_projects')
      .select('share_token')
      .eq('id', item.review_project_id)
      .maybeSingle(),
    userId
      ? supabase
          .from('team_members')
          .select('name, email')
          .eq('user_id', userId)
          .eq('company_id', companyId)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string | null; email: string | null } | null }),
  ]);

  if (!project?.share_token) return;

  const appUrl = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/+$/, '');
  void fetch(`${appUrl}/api/review-notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'review_item_new_version',
      share_token: project.share_token,
      review_item_id: item.id,
      item_title: item.title,
      comment_author: member?.name || 'A team member',
      comment_author_email: member?.email || null,
      comment_content: params.version.notes || null,
    }),
  }).catch(() => {});
}
