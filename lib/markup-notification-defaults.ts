// lib/markup-notification-defaults.ts
//
// Shared helper for reading a company's agency-level markup notification
// defaults. Used when seeding a new `review_project_assignees` row or a new
// `review_project_guest_recipients` row so the project starts with whatever
// the admin chose under Settings → Notifications → Markup defaults.
//
// Once the per-project row exists, it is the source of truth. Defaults are
// NOT applied retroactively.

import type { SupabaseClient } from '@supabase/supabase-js';

export type MarkupNotifyPrefs = {
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
};

export const MARKUP_NOTIFY_KEYS = [
  'notify_comment',
  'notify_reply',
  'notify_resolve',
  'notify_status',
  'notify_new_version',
] as const satisfies readonly (keyof MarkupNotifyPrefs)[];

// All-true matches the DB column DEFAULTs and is the fallback when a
// company row is missing or pre-dates the columns being added.
export const ALL_ON_PREFS: MarkupNotifyPrefs = {
  notify_comment: true,
  notify_reply: true,
  notify_resolve: true,
  notify_status: true,
  notify_new_version: true,
};

export async function getCompanyMarkupDefaults(
  supabase: SupabaseClient,
  companyId: string,
): Promise<MarkupNotifyPrefs> {
  const { data } = await supabase
    .from('companies')
    .select(
      'markup_notify_comment, markup_notify_reply, markup_notify_resolve, markup_notify_status, markup_notify_new_version',
    )
    .eq('id', companyId)
    .single();

  if (!data) return { ...ALL_ON_PREFS };

  const row = data as Record<string, unknown>;
  const pick = (key: string, fallback: boolean) =>
    typeof row[key] === 'boolean' ? (row[key] as boolean) : fallback;

  return {
    notify_comment: pick('markup_notify_comment', true),
    notify_reply: pick('markup_notify_reply', true),
    notify_resolve: pick('markup_notify_resolve', true),
    notify_status: pick('markup_notify_status', true),
    notify_new_version: pick('markup_notify_new_version', true),
  };
}

/**
 * Per-member markup defaults. Member columns override the company default
 * when non-null. Falls back to company defaults for any null member column.
 */
export async function getMemberMarkupDefaults(
  supabase: SupabaseClient,
  companyId: string,
  teamMemberId: string,
): Promise<MarkupNotifyPrefs> {
  const companyDefaults = await getCompanyMarkupDefaults(supabase, companyId);

  const { data: member } = await supabase
    .from('team_members')
    .select(
      'markup_notify_comment, markup_notify_reply, markup_notify_resolve, markup_notify_status, markup_notify_new_version',
    )
    .eq('id', teamMemberId)
    .single();

  if (!member) return companyDefaults;

  const row = member as Record<string, unknown>;
  const merge = (key: keyof MarkupNotifyPrefs, dbKey: string) =>
    typeof row[dbKey] === 'boolean' ? (row[dbKey] as boolean) : companyDefaults[key];

  return {
    notify_comment: merge('notify_comment', 'markup_notify_comment'),
    notify_reply: merge('notify_reply', 'markup_notify_reply'),
    notify_resolve: merge('notify_resolve', 'markup_notify_resolve'),
    notify_status: merge('notify_status', 'markup_notify_status'),
    notify_new_version: merge('notify_new_version', 'markup_notify_new_version'),
  };
}
