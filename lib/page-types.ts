// lib/page-types.ts
// Shared types and helpers for the unified page system.

import { SupabaseClient } from '@supabase/supabase-js';

/* ─── Entity config ──────────────────────────────────────────────────────── */

export type EntityType = 'proposal' | 'document' | 'template';

export interface EntityConfig {
  pagesTable: 'proposal_pages_v2' | 'document_pages_v2' | 'template_pages_v2';
  idColumn:   'proposal_id' | 'document_id' | 'template_id';
}

export function getEntityConfig(entityType: EntityType): EntityConfig {
  switch (entityType) {
    case 'document': return { pagesTable: 'document_pages_v2', idColumn: 'document_id' };
    case 'template': return { pagesTable: 'template_pages_v2', idColumn: 'template_id' };
    default:         return { pagesTable: 'proposal_pages_v2', idColumn: 'proposal_id' };
  }
}

/* ─── UnifiedPage type ───────────────────────────────────────────────────── */

export type PageType = 'pdf' | 'text' | 'pricing' | 'packages' | 'toc' | 'section';

export interface UnifiedPage {
  id:                    string;
  entity_id:             string;
  company_id:            string;
  position:              number;
  type:                  PageType;
  title:                 string;
  indent:                number;
  enabled:               boolean;
  link_url:              string | null;
  link_label:            string | null;
  orientation:           string;
  show_title:            boolean;
  show_member_badge:     boolean;
  show_client_logo:      boolean;
  prepared_by_member_id: string | null;
  payload:               Record<string, unknown>;
  created_at:            string;
  updated_at:            string;
}

/* ─── PageUrlEntry ───────────────────────────────────────────────────────── */

export interface PageUrlEntry {
  id:                    string;
  position:              number;
  type:                  PageType;
  url:                   string | null;
  title:                 string;
  indent:                number;
  link_url?:             string;
  link_label?:           string;
  show_title:            boolean;
  show_member_badge:     boolean;
  prepared_by_member_id: string | null;
  payload:               Record<string, unknown>;
}

/* ─── Mutation option / change types ─────────────────────────────────────── */

export interface AddPageOpts {
  entityId:   string;
  companyId:  string;
  type:       PageType;
  position?:  number;
  title?:     string;
  payload?:   Record<string, unknown>;
  indent?:           number;
  linkUrl?:          string | null;
  linkLabel?:        string | null;
  orientation?:      string;
  showTitle?:        boolean;
  showMemberBadge?:  boolean;
}

export type UpdatePageChanges = Partial<{
  title:                 string;
  indent:                number;
  enabled:               boolean;
  link_url:              string | null;
  link_label:            string | null;
  orientation:           string;
  show_title:            boolean;
  show_member_badge:     boolean;
  show_client_logo:      boolean;
  prepared_by_member_id: string | null;
  payload:               Record<string, unknown>;
  payload_patch:         Record<string, unknown>;
}>;

/* ─── Row mapper ─────────────────────────────────────────────────────────── */

/**
 * Maps a raw DB row (where the FK column is entity-specific) onto UnifiedPage
 * so callers always get `entity_id` regardless of entity type.
 */
export function rowToUnifiedPage(row: Record<string, unknown>, idColumn: string): UnifiedPage {
  return {
    id:                    row.id as string,
    entity_id:             row[idColumn] as string,
    company_id:            row.company_id as string,
    position:              row.position as number,
    type:                  row.type as PageType,
    title:                 row.title as string,
    indent:                (row.indent as number) ?? 0,
    enabled:               (row.enabled as boolean) ?? true,
    link_url:              (row.link_url as string | null) ?? null,
    link_label:            (row.link_label as string | null) ?? null,
    orientation:           (row.orientation as string) ?? 'auto',
    show_title:            (row.show_title as boolean) ?? true,
    show_member_badge:     (row.show_member_badge as boolean) ?? false,
    show_client_logo:      (row.show_client_logo as boolean) ?? false,
    prepared_by_member_id: (row.prepared_by_member_id as string | null) ?? null,
    payload:               (row.payload as Record<string, unknown>) ?? null,
    created_at:            row.created_at as string,
    updated_at:            row.updated_at as string,
  };
}

/* ─── SupabaseClient re-export (convenience) ─────────────────────────────── */

export type { SupabaseClient };
