// lib/page-mutations.ts
// Write operations: addPage, updatePage, deletePage, reorderPages,
// replacePdfPage, insertPdfPage.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type EntityType,
  type UnifiedPage,
  type AddPageOpts,
  type UpdatePageChanges,
  getEntityConfig,
  rowToUnifiedPage,
} from './page-types';

/* ─── addPage ────────────────────────────────────────────────────────────── */

// Note: no DB-level unique constraint on (entity_id, position). Concurrent addPage calls could produce duplicate positions.
export async function addPage(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: AddPageOpts,
): Promise<{ page: UnifiedPage | null; error?: string }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  // Determine insert position
  let insertPosition = opts.position;
  if (insertPosition === undefined) {
    const { data: last } = await supabase
      .from(pagesTable)
      .select('position')
      .eq(idColumn, opts.entityId)
      .order('position', { ascending: false })
      .limit(1)
      .single();
    insertPosition = last ? (last.position as number) + 1 : 0;
  } else {
    // Shift existing rows at or after insertion point
    const { error: shiftError } = await supabase.rpc('shift_page_positions', {
      p_table:     pagesTable,
      p_id_column: idColumn,
      p_entity_id: opts.entityId,
      p_from_pos:  insertPosition,
      p_delta:     1,
    });
    if (shiftError) {
      // Fallback: manual shift if RPC not available
      const { data: toShift } = await supabase
        .from(pagesTable)
        .select('id, position')
        .eq(idColumn, opts.entityId)
        .gte('position', insertPosition)
        .order('position', { ascending: false });

      if (toShift) {
        for (const row of toShift) {
          await supabase
            .from(pagesTable)
            .update({ position: (row.position as number) + 1 })
            .eq('id', row.id);
        }
      }
    }
  }

  const defaultTitle = opts.title ?? (
    opts.type === 'text'     ? 'New Blank Page'     :
    opts.type === 'pricing'  ? 'Project Investment' :
    opts.type === 'packages' ? 'Your Investment'    :
    opts.type === 'section'  ? 'New Section'        :
    opts.type === 'toc'      ? 'Table of Contents'  :
    'New Page'
  );

  const row: Record<string, unknown> = {
    [idColumn]:             opts.entityId,
    company_id:             opts.companyId,
    position:               insertPosition,
    type:                   opts.type,
    title:                  defaultTitle,
    indent:                 opts.indent ?? 0,
    enabled:                true,
    link_url:               opts.linkUrl ?? null,
    link_label:             opts.linkLabel ?? null,
    orientation:            opts.orientation ?? 'auto',
    show_title:             opts.showTitle ?? true,
    show_member_badge:      opts.showMemberBadge ?? false,
    payload:                opts.payload ?? {},
  };

  const { data, error } = await supabase
    .from(pagesTable)
    .insert(row)
    .select()
    .single();

  if (error) return { page: null, error: error.message };

  return { page: rowToUnifiedPage(data as Record<string, unknown>, idColumn) };
}

/* ─── updatePage ─────────────────────────────────────────────────────────── */

export async function updatePage(
  supabase: SupabaseClient,
  entityType: EntityType,
  pageId: string,
  changes: UpdatePageChanges,
  opts?: { entityId?: string },
): Promise<{ page: UnifiedPage | null; error?: string }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  let updates: Record<string, unknown> = { ...changes };
  if (changes.payload_patch) {
    const { payload_patch, ...rest } = changes;

    // Try atomic JSONB merge via RPC to avoid read-modify-write races.
    const { data: merged, error: rpcErr } = await supabase.rpc('merge_page_payload', {
      p_table: pagesTable,
      p_page_id: pageId,
      p_patch: payload_patch,
    });

    if (!rpcErr && merged !== null) {
      // RPC handled the payload merge atomically. Only update non-payload fields.
      if (Object.keys(rest).length > 0) {
        updates = { ...rest };
      } else {
        // Nothing else to update — re-read and return the page.
        const { data: page } = await supabase
          .from(pagesTable)
          .select()
          .eq('id', pageId)
          .single();
        return { page: page ? rowToUnifiedPage(page as Record<string, unknown>, idColumn) : null };
      }
    } else {
      // Fallback: client-side merge (pre-migration DBs)
      const { data: current } = await supabase
        .from(pagesTable)
        .select('payload')
        .eq('id', pageId)
        .single();

      updates = {
        ...rest,
        payload: { ...((current?.payload as Record<string, unknown>) ?? {}), ...payload_patch },
      };
    }
  }

  let query = supabase
    .from(pagesTable)
    .update(updates)
    .eq('id', pageId);

  // Scope to entity when provided to prevent cross-tenant writes
  if (opts?.entityId) {
    query = query.eq(idColumn, opts.entityId);
  }

  const { data, error } = await query.select().single();

  if (error) return { page: null, error: error.message };

  return { page: rowToUnifiedPage(data as Record<string, unknown>, idColumn) };
}

/* ─── deletePage ─────────────────────────────────────────────────────────── */

export async function deletePage(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId: string; pageId: string },
): Promise<{ success: boolean; totalPages: number; error?: string; status?: number }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  // Guard: don't allow deleting the last page (count all pages, not just enabled)
  const { count: total } = await supabase
    .from(pagesTable)
    .select('*', { count: 'exact', head: true })
    .eq(idColumn, opts.entityId);

  if ((total ?? 0) <= 1) {
    return { success: false, totalPages: total ?? 1, error: 'Cannot delete the only remaining page.', status: 400 };
  }

  // Fetch the page — scoped to entity to prevent cross-tenant access.
  const { data: page, error: fetchError } = await supabase
    .from(pagesTable)
    .select('type, payload')
    .eq('id', opts.pageId)
    .eq(idColumn, opts.entityId)
    .single();

  if (fetchError || !page) {
    return { success: false, totalPages: total ?? 0, error: 'Page not found', status: 404 };
  }

  // Delete the row — scoped to entity to prevent cross-tenant deletes.
  const { error: deleteError } = await supabase
    .from(pagesTable)
    .delete()
    .eq('id', opts.pageId)
    .eq(idColumn, opts.entityId);

  if (deleteError) {
    return { success: false, totalPages: total ?? 0, error: 'Failed to delete page record' };
  }

  // Non-fatal: clean up storage file for pdf pages
  if (page.type === 'pdf') {
    const filePath = (page.payload as Record<string, unknown>)?.file_path as string | undefined;
    if (filePath) {
      supabase.storage
        .from('proposals')
        .remove([filePath])
        .catch((err) => console.error(`Non-fatal: failed to delete storage file ${filePath}:`, err));
    }
  }

  const { count: remaining } = await supabase
    .from(pagesTable)
    .select('*', { count: 'exact', head: true })
    .eq(idColumn, opts.entityId)
    .eq('enabled', true);

  return { success: true, totalPages: remaining ?? 0 };
}

/* ─── reorderPages ───────────────────────────────────────────────────────── */

/**
 * Accepts an ordered array of page IDs and assigns position = index.
 * Uses negative intermediary values to avoid unique constraint issues.
 */
export async function reorderPages(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId: string; orderedIds: string[] },
): Promise<{ success: boolean; error?: string }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  if (opts.orderedIds.length === 0) return { success: true };

  // Prefer the atomic RPC that runs both passes inside a single transaction.
  const { error: rpcErr } = await supabase.rpc('reorder_pages', {
    p_table: pagesTable,
    p_id_column: idColumn,
    p_entity_id: opts.entityId,
    p_ordered_ids: opts.orderedIds,
  });

  if (!rpcErr) return { success: true };

  // Fallback: sequential updates (non-atomic, for pre-migration DBs)
  console.warn('reorder_pages RPC unavailable, falling back to sequential updates:', rpcErr.message);

  for (let i = 0; i < opts.orderedIds.length; i++) {
    await supabase
      .from(pagesTable)
      .update({ position: -(i + 1) })
      .eq('id', opts.orderedIds[i])
      .eq(idColumn, opts.entityId);
  }

  for (let i = 0; i < opts.orderedIds.length; i++) {
    const { error } = await supabase
      .from(pagesTable)
      .update({ position: i })
      .eq('id', opts.orderedIds[i])
      .eq(idColumn, opts.entityId);

    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

/* ─── replacePdfPage ─────────────────────────────────────────────────────── */

/**
 * Replaces the file_path inside a PDF page's payload.
 * Deletes the old storage file non-fatally.
 */
export async function replacePdfPage(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { pageId: string; tempPath: string; entityId?: string },
): Promise<{ success: boolean; error?: string }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  let fetchQuery = supabase
    .from(pagesTable)
    .select('payload')
    .eq('id', opts.pageId);
  if (opts.entityId) fetchQuery = fetchQuery.eq(idColumn, opts.entityId);
  const { data: current, error: fetchError } = await fetchQuery.single();

  if (fetchError || !current) return { success: false, error: 'Page not found' };

  const oldPayload = (current.payload ?? {}) as Record<string, unknown>;
  const oldFilePath = oldPayload.file_path as string | undefined;

  const { error: updateError } = await supabase
    .from(pagesTable)
    .update({ payload: { ...oldPayload, file_path: opts.tempPath } })
    .eq('id', opts.pageId);

  if (updateError) {
    supabase.storage.from('proposals').remove([opts.tempPath]).catch(() => {});
    return { success: false, error: 'Failed to update page record' };
  }

  if (oldFilePath && oldFilePath !== opts.tempPath) {
    supabase.storage
      .from('proposals')
      .remove([oldFilePath])
      .catch((err) => console.error(`Non-fatal: failed to delete old page file ${oldFilePath}:`, err));
  }

  return { success: true };
}

/* ─── insertPdfPage ──────────────────────────────────────────────────────── */

/**
 * Inserts a new PDF page at a specific position (after `afterPosition`).
 * Shifts subsequent rows up by 1.
 */
export async function insertPdfPage(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: {
    entityId:      string;
    companyId:     string;
    afterPosition: number;
    tempPath:      string;
  },
): Promise<{ page: UnifiedPage | null; totalPages: number; error?: string; status?: number }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  const newPosition = opts.afterPosition + 1;

  // Shift pages at or after the insertion point
  const { data: toShift, error: fetchError } = await supabase
    .from(pagesTable)
    .select('id, position')
    .eq(idColumn, opts.entityId)
    .gte('position', newPosition)
    .order('position', { ascending: false });

  if (fetchError) return { page: null, totalPages: 0, error: 'Failed to fetch pages' };

  for (const row of (toShift ?? [])) {
    await supabase
      .from(pagesTable)
      .update({ position: (row.position as number) + 1 })
      .eq('id', row.id)
      .eq(idColumn, opts.entityId);
  }

  const { data: inserted, error: insertError } = await supabase
    .from(pagesTable)
    .insert({
      [idColumn]:  opts.entityId,
      company_id:  opts.companyId,
      position:    newPosition,
      type:        'pdf',
      title:       `Page ${newPosition + 1}`,
      indent:      0,
      enabled:     true,
      payload:     { file_path: opts.tempPath },
    })
    .select()
    .single();

  if (insertError) {
    // Rollback the position shifts — best-effort, scoped to entity
    try {
      for (const row of (toShift ?? [])) {
        await supabase
          .from(pagesTable)
          .update({ position: row.position })
          .eq('id', row.id)
          .eq(idColumn, opts.entityId);
      }
    } catch (rollbackErr) {
      console.error('insertPdfPage: rollback failed after insert error — positions may be inconsistent', rollbackErr);
    }
    return { page: null, totalPages: 0, error: 'Failed to insert page record' };
  }

  const { count } = await supabase
    .from(pagesTable)
    .select('*', { count: 'exact', head: true })
    .eq(idColumn, opts.entityId)
    .eq('enabled', true);

  return {
    page:       rowToUnifiedPage(inserted as Record<string, unknown>, idColumn),
    totalPages: count ?? 0,
  };
}
