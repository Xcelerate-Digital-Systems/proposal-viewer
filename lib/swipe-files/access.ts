// lib/swipe-files/access.ts
//
// Access control helpers for the per-folder sharing model (ADR: Option 2).
// A swipe_types row is owned by a single company_id. It may also be shared
// with additional companies via shared_with_company_ids. Partners can READ
// the folder and READ/WRITE files inside it. Only the owner can rename,
// delete, or change the share list of the folder itself.

import type { SupabaseClient } from '@supabase/supabase-js';

type TypeAccessRow = {
  id: string;
  company_id: string;
  shared_with_company_ids: string[] | null;
};

export function canAccessType(type: TypeAccessRow, companyId: string): boolean {
  return (
    type.company_id === companyId ||
    (type.shared_with_company_ids || []).includes(companyId)
  );
}

export function isTypeOwner(type: TypeAccessRow, companyId: string): boolean {
  return type.company_id === companyId;
}

/**
 * PostgREST .or() fragment that matches types visible to the caller:
 * either owned by them, or explicitly shared with them.
 */
export function visibleTypesOrFilter(companyId: string): string {
  return `company_id.eq.${companyId},shared_with_company_ids.cs.{${companyId}}`;
}

/**
 * Companies this company has an established sharing relationship with —
 * either because we've shared folders to them, or because they've shared
 * folders to us. Used to auto-populate shared_with_company_ids on new
 * folders so a user who works across paired companies doesn't have to
 * re-configure sharing every time they create a folder.
 *
 * The relationship is bootstrapped by share-xds-bld-backfill.sql (or any
 * manual sharing the owner configures); from then on, new folders inherit
 * the same partner set symmetrically.
 */
export async function getPartnerCompanyIds(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase
      .from('swipe_types')
      .select('shared_with_company_ids')
      .eq('company_id', companyId),
    supabase
      .from('swipe_types')
      .select('company_id')
      .contains('shared_with_company_ids', [companyId]),
  ]);

  const partners = new Set<string>();
  (outgoing || []).forEach((row: { shared_with_company_ids: string[] | null }) => {
    (row.shared_with_company_ids || []).forEach((id) => {
      if (id && id !== companyId) partners.add(id);
    });
  });
  (incoming || []).forEach((row: { company_id: string }) => {
    if (row.company_id && row.company_id !== companyId) partners.add(row.company_id);
  });
  return Array.from(partners);
}

/**
 * Fetch a type row by id and verify the caller can access it.
 * Returns the row (plus owner flag) or null if missing/forbidden.
 */
export async function fetchAccessibleType(
  supabase: SupabaseClient,
  typeId: string,
  companyId: string,
): Promise<{ type: TypeAccessRow; isOwner: boolean } | null> {
  const { data } = await supabase
    .from('swipe_types')
    .select('id, company_id, shared_with_company_ids')
    .eq('id', typeId)
    .single();

  if (!data) return null;
  if (!canAccessType(data, companyId)) return null;
  return { type: data, isOwner: isTypeOwner(data, companyId) };
}

/**
 * Fetch a swipe_files row by id, joining its owning type for access checks.
 * Returns the row + type context or null if missing/forbidden.
 */
export async function fetchAccessibleFile(
  supabase: SupabaseClient,
  fileId: string,
  companyId: string,
): Promise<{
  file: { id: string; company_id: string; type_id: string; media_type: string | null; media_url: string | null };
  type: TypeAccessRow;
} | null> {
  const { data } = await supabase
    .from('swipe_files')
    .select('id, company_id, type_id, media_type, media_url, swipe_types!inner(id, company_id, shared_with_company_ids)')
    .eq('id', fileId)
    .single();

  if (!data) return null;
  // Supabase returns the joined row as an object for !inner single fk.
  const t = (data as unknown as { swipe_types: TypeAccessRow }).swipe_types;
  if (!t || !canAccessType(t, companyId)) return null;
  return {
    file: {
      id: data.id as string,
      company_id: data.company_id as string,
      type_id: data.type_id as string,
      media_type: (data as { media_type: string | null }).media_type ?? null,
      media_url: (data as { media_url: string | null }).media_url ?? null,
    },
    type: t,
  };
}
