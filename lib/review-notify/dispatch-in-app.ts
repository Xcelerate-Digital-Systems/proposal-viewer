// lib/review-notify/dispatch-in-app.ts
// Wraps the resolve-user-ids → filter-author → insert pattern for in-app
// notifications, which repeats 3 times in the review-notify route.

import { createServiceClient } from '@/lib/supabase-server';
import {
  insertInAppNotifications,
  resolveUserIdsForCompanyEmails,
  type NotificationCategory,
} from '@/lib/in-app-notifications';

export async function dispatchInAppNotifications(params: {
  supabase: ReturnType<typeof createServiceClient>;
  companyId: string;
  recipientEmails: string[];
  excludeUserId: string | null;
  category: NotificationCategory;
  title: string;
  body: string | null;
  link: string;
}): Promise<void> {
  const {
    supabase, companyId, recipientEmails, excludeUserId,
    category, title, body, link,
  } = params;

  if (recipientEmails.length === 0) return;

  let userIds = await resolveUserIdsForCompanyEmails(supabase, companyId, recipientEmails);
  if (excludeUserId) {
    userIds = userIds.filter((uid) => uid !== excludeUserId);
  }
  if (userIds.length === 0) return;

  await insertInAppNotifications({
    supabase,
    companyId,
    userIds,
    category,
    title,
    body,
    link,
  });
}
