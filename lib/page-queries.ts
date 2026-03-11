// lib/page-queries.ts
// Read-only page operations: getPages, getPageUrls.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type EntityType,
  type UnifiedPage,
  type PageUrlEntry,
  type PageType,
  getEntityConfig,
  rowToUnifiedPage,
} from './page-types';

/* ─── getPages ───────────────────────────────────────────────────────────── */

export async function getPages(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string,
): Promise<{ pages: UnifiedPage[]; error?: string }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  const { data, error } = await supabase
    .from(pagesTable)
    .select('*')
    .eq(idColumn, entityId)
    .order('position', { ascending: true });

  if (error) return { pages: [], error: error.message };

  return {
    pages: (data ?? []).map((row) => rowToUnifiedPage(row as Record<string, unknown>, idColumn)),
  };
}

/* ─── getPageUrls ────────────────────────────────────────────────────────── */

/**
 * Returns all pages for a proposal or document, with signed storage URLs for
 * PDF pages. Used by the client-facing viewer.
 *
 * Resolves entity ID from either a direct UUID or a share token.
 */
export async function getPageUrls(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId?: string | null; shareToken?: string | null },
): Promise<{ pages: PageUrlEntry[]; error?: string }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  let resolvedId = opts.entityId ?? null;

  if (!resolvedId && opts.shareToken) {
    const entityTable = entityType === 'document' ? 'documents' : 'proposals';
    const { data: entity, error } = await supabase
      .from(entityTable)
      .select('id')
      .eq('share_token', opts.shareToken)
      .single();

    if (error || !entity) return { pages: [], error: 'Not found' };
    resolvedId = entity.id;
  }

  if (!resolvedId) return { pages: [], error: 'No entity ID' };

  const { data: rows, error: pagesError } = await supabase
    .from(pagesTable)
    .select('id, position, type, title, indent, link_url, link_label, show_title, show_member_badge, show_client_logo, prepared_by_member_id, payload')
    .eq(idColumn, resolvedId)
    .eq('enabled', true)
    .order('position', { ascending: true });

  if (pagesError) return { pages: [], error: 'Failed to fetch pages' };
  if (!rows || rows.length === 0) return { pages: [] };

  const results = await Promise.all(
    rows.map(async (row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      let signedUrl: string | null = null;

      if (row.type === 'pdf' && payload.file_path) {
        const { data: signed } = await supabase.storage
          .from('proposals')
          .createSignedUrl(payload.file_path as string, 2592000);
        signedUrl = signed?.signedUrl ?? null;
      }

      return {
        id:                    row.id as string,
        position:              row.position as number,
        type:                  row.type as PageType,
        url:                   signedUrl,
        title:                 row.title as string,
        indent:                (row.indent as number) ?? 0,
        link_url:              (row.link_url as string) || undefined,
        link_label:            (row.link_label as string) || undefined,
        show_title:            (row.show_title as boolean) ?? true,
        show_member_badge:     (row.show_member_badge as boolean) ?? false,
        show_client_logo:      (row.show_client_logo as boolean) ?? false,
        prepared_by_member_id: (row.prepared_by_member_id as string | null) ?? null,
        payload,
      };
    }),
  );

  const failed = results.filter((p) => p.type === 'pdf' && !p.url);
  if (failed.length > 0) {
    console.error(
      `page-operations: failed to sign ${failed.length} PDF page(s) for ${entityType} ${resolvedId}`,
    );
  }

  return { pages: results };
}
