// lib/in-app-notifications.ts
// Server-side helper for inserting in-app notifications.

import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationCategory =
  | 'proposal_viewed' | 'proposal_accepted' | 'proposal_declined'
  | 'proposal_revision_requested' | 'comment_added' | 'comment_resolved'
  | 'review_comment' | 'review_status' | 'review_new_version'
  | 'review_complete' | 'mention';

interface InsertNotificationParams {
  supabase: SupabaseClient;
  companyId: string;
  userIds: string[];
  category: NotificationCategory;
  title: string;
  body?: string | null;
  link?: string | null;
}

export async function insertInAppNotifications(params: InsertNotificationParams) {
  const { supabase, companyId, userIds, category, title, body, link } = params;
  if (userIds.length === 0) return;

  const rows = userIds.map((uid) => ({
    user_id: uid,
    company_id: companyId,
    category,
    title,
    body: body ?? null,
    link: link ?? null,
  }));

  const { error } = await supabase.from('in_app_notifications').insert(rows);
  if (error) {
    console.error('Failed to insert in-app notifications:', error);
  }
}

export async function resolveUserIdsForTeamMembers(
  supabase: SupabaseClient,
  teamMemberIds: string[],
): Promise<string[]> {
  if (teamMemberIds.length === 0) return [];
  const { data } = await supabase
    .from('team_members')
    .select('user_id')
    .in('id', teamMemberIds)
    .not('user_id', 'is', null);
  return (data ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean);
}

export async function resolveUserIdsForCompanyEmails(
  supabase: SupabaseClient,
  companyId: string,
  emails: string[],
): Promise<string[]> {
  if (emails.length === 0) return [];
  const { data } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('company_id', companyId)
    .in('email', emails)
    .not('user_id', 'is', null);
  return (data ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean);
}
