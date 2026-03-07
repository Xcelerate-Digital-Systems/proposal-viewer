// lib/page-operations.ts

import { SupabaseClient } from '@supabase/supabase-js';

/* ─── Entity config ──────────────────────────────────────────────────────── */

export type EntityType = 'proposal' | 'document';

export interface EntityConfig {
  entityTable: 'proposals' | 'documents';
  pagesTable:  'proposal_pages' | 'document_pages';
  idColumn:    'proposal_id' | 'document_id';
}

export function getEntityConfig(entityType: EntityType): EntityConfig {
  if (entityType === 'document') {
    return {
      entityTable: 'documents',
      pagesTable:  'document_pages',
      idColumn:    'document_id',
    };
  }
  return {
    entityTable: 'proposals',
    pagesTable:  'proposal_pages',
    idColumn:    'proposal_id',
  };
}

/* ─── Page URL response shape ────────────────────────────────────────────── */

export interface PageUrlEntry {
  page_number: number;
  url:         string | null;
  label:       string;
  indent:      number;
  link_url?:   string;
  link_label?: string;
}

/* ─── getPageUrls ────────────────────────────────────────────────────────── */

/**
 * Returns signed storage URLs for every page of a proposal or document.
 * Resolves entity ID from either a direct UUID or a share token.
 *
 * Returns { pages: [], fallback: true } when no page rows exist yet
 * (pre-backfill), so callers can fall back to the legacy merged-PDF path.
 */
export async function getPageUrls(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId?: string | null; shareToken?: string | null },
): Promise<{ pages: PageUrlEntry[]; fallback: boolean; error?: string }> {
  const { entityTable, pagesTable, idColumn } = getEntityConfig(entityType);

  let resolvedId = opts.entityId ?? null;

  if (!resolvedId && opts.shareToken) {
    const { data: entity, error } = await supabase
      .from(entityTable)
      .select('id')
      .eq('share_token', opts.shareToken)
      .single();

    if (error || !entity) return { pages: [], fallback: false, error: 'Not found' };
    resolvedId = entity.id;
  }

  if (!resolvedId) return { pages: [], fallback: false, error: 'No entity ID' };

  const { data: pages, error: pagesError } = await supabase
    .from(pagesTable)
    .select('page_number, file_path, label, indent, link_url, link_label')
    .eq(idColumn, resolvedId)
    .order('page_number', { ascending: true });

  if (pagesError) return { pages: [], fallback: false, error: 'Failed to fetch pages' };
  if (!pages || pages.length === 0) return { pages: [], fallback: true };

  const signedPages = await Promise.all(
    pages.map(async (page) => {
      const { data: signed } = await supabase.storage
        .from('proposals')
        .createSignedUrl(page.file_path, 2592000);

      return {
        page_number: page.page_number,
        url:         signed?.signedUrl ?? null,
        label:       page.label,
        indent:      page.indent,
        link_url:    page.link_url   ?? undefined,
        link_label:  page.link_label ?? undefined,
      };
    }),
  );

  const failed = signedPages.filter((p) => !p.url);
  if (failed.length > 0) {
    console.error(
      `page-operations: failed to sign ${failed.length} page(s) for ${entityType} ${resolvedId}`,
      failed.map((p) => p.page_number),
    );
  }

  return { pages: signedPages.filter((p) => p.url) as PageUrlEntry[], fallback: false };
}

/* ─── replacePage ────────────────────────────────────────────────────────── */

export async function replacePage(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId: string; pageNumber: number; tempPath: string },
): Promise<{ success: boolean; totalPages: number; error?: string }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  const { data: targetPage, error: pageError } = await supabase
    .from(pagesTable)
    .select('id, page_number, file_path')
    .eq(idColumn, opts.entityId)
    .eq('page_number', opts.pageNumber)
    .single();

  if (pageError || !targetPage) return { success: false, totalPages: 0, error: 'Page not found' };

  const oldFilePath = targetPage.file_path;

  const { error: updateError } = await supabase
    .from(pagesTable)
    .update({ file_path: opts.tempPath })
    .eq('id', targetPage.id);

  if (updateError) {
    supabase.storage.from('proposals').remove([opts.tempPath]).catch(() => {});
    return { success: false, totalPages: 0, error: 'Failed to update page record' };
  }

  if (oldFilePath && oldFilePath !== opts.tempPath) {
    supabase.storage
      .from('proposals')
      .remove([oldFilePath])
      .catch((err) => console.error(`Non-fatal: failed to delete old page file ${oldFilePath}:`, err));
  }

  const { count } = await supabase
    .from(pagesTable)
    .select('*', { count: 'exact', head: true })
    .eq(idColumn, opts.entityId);

  return { success: true, totalPages: count ?? 0 };
}

/* ─── deletePage ─────────────────────────────────────────────────────────── */

export async function deletePage(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId: string; pageNumber: number },
): Promise<{ success: boolean; totalPages: number; error?: string; status?: number }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  const { data: allPages, error: fetchError } = await supabase
    .from(pagesTable)
    .select('id, page_number, file_path, label')
    .eq(idColumn, opts.entityId)
    .order('page_number', { ascending: true });

  if (fetchError || !allPages) return { success: false, totalPages: 0, error: 'Failed to fetch pages' };

  const totalPages = allPages.length;

  if (totalPages <= 1) {
    return { success: false, totalPages, error: 'Cannot delete the only remaining page.', status: 400 };
  }

  if (opts.pageNumber < 1 || opts.pageNumber > totalPages) {
    return { success: false, totalPages, error: `Invalid page number. ${entityType} has ${totalPages} pages.`, status: 400 };
  }

  const targetPage = allPages.find((p) => p.page_number === opts.pageNumber);
  if (!targetPage) return { success: false, totalPages, error: 'Page not found', status: 404 };

  supabase.storage
    .from('proposals')
    .remove([targetPage.file_path])
    .catch((err) => console.error(`Non-fatal: failed to delete storage file ${targetPage.file_path}:`, err));

  const { error: deleteError } = await supabase
    .from(pagesTable)
    .delete()
    .eq('id', targetPage.id);

  if (deleteError) return { success: false, totalPages, error: 'Failed to delete page record' };

  const laterPages = allPages
    .filter((p) => p.page_number > opts.pageNumber)
    .sort((a, b) => a.page_number - b.page_number);

  for (const page of laterPages) {
    await supabase
      .from(pagesTable)
      .update({ page_number: page.page_number - 1 })
      .eq('id', page.id);
  }

  return { success: true, totalPages: totalPages - 1 };
}

/* ─── insertPage ─────────────────────────────────────────────────────────── */

export async function insertPage(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId: string; afterPage: number; tempPath: string },
): Promise<{ success: boolean; totalPages: number; pagesInserted: number; error?: string; status?: number }> {
  const { entityTable, pagesTable, idColumn } = getEntityConfig(entityType);

  const { data: entity, error: entityError } = await supabase
    .from(entityTable)
    .select('id, company_id')
    .eq('id', opts.entityId)
    .single();

  if (entityError || !entity) {
    return { success: false, totalPages: 0, pagesInserted: 0, error: `${entityType} not found`, status: 404 };
  }

  const { data: existingPages, error: pagesError } = await supabase
    .from(pagesTable)
    .select('id, page_number')
    .eq(idColumn, opts.entityId)
    .order('page_number', { ascending: true });

  if (pagesError) {
    return { success: false, totalPages: 0, pagesInserted: 0, error: 'Failed to fetch pages' };
  }

  const totalPages = existingPages?.length ?? 0;
  const newPageNum = opts.afterPage + 1;

  if (opts.afterPage < 0 || opts.afterPage > totalPages) {
    return { success: false, totalPages, pagesInserted: 0, error: `Invalid position. ${entityType} has ${totalPages} pages.`, status: 400 };
  }

  const pagesToShift = (existingPages ?? [])
    .filter((p) => p.page_number >= newPageNum)
    .sort((a, b) => b.page_number - a.page_number);

  for (const page of pagesToShift) {
    await supabase
      .from(pagesTable)
      .update({ page_number: page.page_number + 1 })
      .eq('id', page.id);
  }

  const { error: insertError } = await supabase
    .from(pagesTable)
    .insert({
      [idColumn]:  opts.entityId,
      company_id:  entity.company_id,
      page_number: newPageNum,
      file_path:   opts.tempPath,
      label:       `Page ${newPageNum}`,
      indent:      0,
    });

  if (insertError) {
    console.error('Insert page row failed, rolling back shift:', insertError.message);
    for (const page of pagesToShift) {
      await supabase
        .from(pagesTable)
        .update({ page_number: page.page_number })
        .eq('id', page.id);
    }
    return { success: false, totalPages, pagesInserted: 0, error: 'Failed to insert page record' };
  }

  return { success: true, totalPages: totalPages + 1, pagesInserted: 1 };
}

/* ─── reorderPages ───────────────────────────────────────────────────────── */

export async function reorderPages(
  supabase: SupabaseClient,
  entityType: EntityType,
  opts: { entityId: string; pageOrder: number[] },
): Promise<{ success: boolean; reordered: boolean; totalPages: number; error?: string; status?: number }> {
  const { pagesTable, idColumn } = getEntityConfig(entityType);

  const { data: pages, error: pagesError } = await supabase
    .from(pagesTable)
    .select('id, page_number')
    .eq(idColumn, opts.entityId)
    .order('page_number', { ascending: true });

  if (pagesError || !pages) {
    return { success: false, reordered: false, totalPages: 0, error: 'Failed to fetch pages' };
  }

  const totalPages = pages.length;

  if (opts.pageOrder.length !== totalPages) {
    return {
      success: false, reordered: false, totalPages,
      error: `page_order length (${opts.pageOrder.length}) must match page count (${totalPages})`,
      status: 400,
    };
  }

  const sorted   = [...opts.pageOrder].sort((a, b) => a - b);
  const expected = Array.from({ length: totalPages }, (_, i) => i);
  if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
    return {
      success: false, reordered: false, totalPages,
      error: 'page_order must contain each index exactly once (0-based)',
      status: 400,
    };
  }

  const isIdentity = opts.pageOrder.every((v, i) => v === i);
  if (isIdentity) return { success: true, reordered: false, totalPages };

  // Pass 1: negative values to vacate the positive space without constraint conflicts
  for (let i = 0; i < totalPages; i++) {
    const page = pages[opts.pageOrder[i]];
    await supabase.from(pagesTable).update({ page_number: -(i + 1) }).eq('id', page.id);
  }

  // Pass 2: final positive values
  for (let i = 0; i < totalPages; i++) {
    const page = pages[opts.pageOrder[i]];
    await supabase.from(pagesTable).update({ page_number: i + 1 }).eq('id', page.id);
  }

  return { success: true, reordered: true, totalPages };
}