// lib/import-pages.ts
// Shared logic for importing pages from one entity into another.
// Used by both /api/templates/pages/import and /api/proposals/pages/import.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type EntityType,
  type UnifiedPage,
  getEntityConfig,
  rowToUnifiedPage,
} from './page-types';

interface ImportPagesOpts {
  sourcePageIds: string[];
  targetEntityId: string;
  targetCompanyId: string;
  targetEntityType: EntityType;
}

export async function importPages(
  supabase: SupabaseClient,
  opts: ImportPagesOpts,
): Promise<{ pages: UnifiedPage[]; error?: string }> {
  const { sourcePageIds, targetEntityId, targetCompanyId, targetEntityType } = opts;
  const { pagesTable: targetTable, idColumn: targetIdCol } = getEntityConfig(targetEntityType);

  if (sourcePageIds.length === 0) {
    return { pages: [], error: 'No pages selected' };
  }

  // Fetch source pages from template_pages_v2 (source is always a template)
  const { data: sourcePages, error: fetchErr } = await supabase
    .from('template_pages_v2')
    .select('*')
    .in('id', sourcePageIds)
    .order('position', { ascending: true });

  if (fetchErr || !sourcePages?.length) {
    return { pages: [], error: 'Source pages not found' };
  }

  // Determine insert position — append after current last page
  const { data: lastPage } = await supabase
    .from(targetTable)
    .select('position')
    .eq(targetIdCol, targetEntityId)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  let nextPosition = lastPage ? (lastPage.position as number) + 1 : 0;
  const inserted: UnifiedPage[] = [];

  for (const src of sourcePages) {
    let payload = (src.payload ?? {}) as Record<string, unknown>;

    // For PDF pages, copy the storage file to a new path
    if (src.type === 'pdf' && payload.file_path) {
      const srcPath = payload.file_path as string;
      const ext = srcPath.split('.').pop() || 'pdf';
      const folder = targetEntityType === 'template' ? 'templates' : 'proposals';
      const destPath = `${folder}/${targetEntityId}/imported-${Date.now()}-${nextPosition}.${ext}`;

      const { error: copyErr } = await supabase.storage
        .from('proposals')
        .copy(srcPath, destPath);

      if (copyErr) {
        // If copy fails, skip this page but continue with others
        console.error(`[import-pages] Failed to copy ${srcPath}:`, copyErr.message);
        nextPosition++;
        continue;
      }

      payload = { ...payload, file_path: destPath };
    }

    const row: Record<string, unknown> = {
      [targetIdCol]:          targetEntityId,
      company_id:             targetCompanyId,
      position:               nextPosition,
      type:                   src.type,
      title:                  src.title,
      indent:                 src.indent ?? 0,
      enabled:                true,
      link_url:               src.link_url ?? null,
      link_label:             src.link_label ?? null,
      orientation:            src.orientation ?? 'auto',
      show_title:             src.show_title ?? true,
      show_member_badge:      src.show_member_badge ?? false,
      show_client_logo:       src.show_client_logo ?? false,
      prepared_by_member_id:  src.prepared_by_member_id ?? null,
      payload,
    };

    const { data, error: insertErr } = await supabase
      .from(targetTable)
      .insert(row)
      .select()
      .single();

    if (insertErr) {
      console.error(`[import-pages] Failed to insert page:`, insertErr.message);
      nextPosition++;
      continue;
    }

    inserted.push(rowToUnifiedPage(data as Record<string, unknown>, targetIdCol));
    nextPosition++;
  }

  if (inserted.length === 0) {
    return { pages: [], error: 'Failed to import any pages' };
  }

  return { pages: inserted };
}
