// app/api/review-notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getResend, FROM_EMAIL } from '@/lib/resend';
import { buildReviewUrl } from '@/lib/proposal-url';
import crypto from 'crypto';
import { isValidWebhookUrl } from '@/lib/sanitize';
import { isInternalStage } from '@/lib/feedback/visibility';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  buildStatusEmail,
  buildNewVersionEmail as buildBrandedNewVersionEmail,
  type EmailBranding,
} from '@/lib/review-notification-emails';
import { syncCommentMentions, type PersistedMention } from '@/lib/feedback/persist-mentions';
import { htmlToPlainText } from '@/lib/feedback/mention-html';
import {
  insertInAppNotifications,
  resolveUserIdsForCompanyEmails,
  type NotificationCategory,
} from '@/lib/in-app-notifications';

const REVIEW_NOTIFY_LIMIT = 20;
const REVIEW_NOTIFY_WINDOW_SECONDS = 60;

type ReviewEventType =
  | 'review_comment_added'
  | 'review_comment_resolved'
  | 'review_item_approved'
  | 'review_item_revision_needed'
  | 'review_feedback_marked_complete'
  | 'review_item_new_version';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      event_type,
      share_token,
      review_item_id,
      review_comment_id,
      comment_author,
      comment_author_email,
      comment_content,
      parent_comment_id,
      resolved_by,
      item_title,
    } = body as {
      event_type: ReviewEventType;
      share_token: string;
      review_item_id?: string;
      review_comment_id?: string;
      comment_author?: string;
      comment_author_email?: string;
      comment_content?: string;
      parent_comment_id?: string;
      resolved_by?: string;
      item_title?: string;
    };

    if (!event_type || !share_token) {
      return NextResponse.json({ error: 'Missing event_type or share_token' }, { status: 400 });
    }

    const validEvents: ReviewEventType[] = [
      'review_comment_added', 'review_comment_resolved',
      'review_item_approved', 'review_item_revision_needed',
      'review_feedback_marked_complete', 'review_item_new_version',
    ];
    if (!validEvents.includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    const rl = await rateLimit({
      key: `review-notify:${share_token}`,
      limit: REVIEW_NOTIFY_LIMIT,
      windowSeconds: REVIEW_NOTIFY_WINDOW_SECONDS,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many notification triggers for this review project' },
        { status: 429, headers: rateLimitHeaders(rl, REVIEW_NOTIFY_LIMIT) },
      );
    }

    const supabase = createServiceClient();

    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, title, client_name, client_email, company_id, share_token, created_by')
      .eq('share_token', share_token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Feedback project not found' }, { status: 404 });
    }

    // Validate that the review_comment_id belongs to an item in this project.
    if (review_comment_id) {
      const { data: commentRow } = await supabase
        .from('review_comments')
        .select('id, review_item_id, review_items:review_item_id(review_project_id)')
        .eq('id', review_comment_id)
        .maybeSingle();
      const rel = (commentRow as { review_items?: { review_project_id?: string } | { review_project_id?: string }[] } | null)?.review_items;
      const arr = Array.isArray(rel) ? rel : rel ? [rel] : [];
      const commentProjectId = arr[0]?.review_project_id ?? null;
      if (!commentRow || commentProjectId !== project.id) {
        return NextResponse.json(
          { error: 'review_comment_id does not belong to this project' },
          { status: 403 },
        );
      }
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name, custom_domain, domain_verified, logo_path, accent_color')
      .eq('id', project.company_id)
      .single();

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const verifiedDomain = company?.domain_verified ? company.custom_domain : null;
    const reviewUrl = buildReviewUrl(project.share_token, verifiedDomain, appUrl);
    const companyName = company?.name || 'Your agency';
    const accentColor = company?.accent_color || '#017C87';
    const logoUrl = company?.logo_path
      ? supabase.storage.from('company-assets').getPublicUrl(company.logo_path).data.publicUrl
      : null;
    const branding: EmailBranding = { companyName, accentColor, logoUrl };

    const isComment = event_type === 'review_comment_added';
    const isReply = isComment && !!parent_comment_id;
    const isNewVersion = event_type === 'review_item_new_version';
    const actorEmail = (comment_author_email || '').trim().toLowerCase() || null;

    // Resolve the item's current stage (when scoped to one). Stage is used to
    // filter assignees by their `stages` array and to keep internal-stage
    // events from reaching guest emails entirely.
    let itemStage: string | null = null;
    if (review_item_id) {
      const { data: itemRow } = await supabase
        .from('review_items')
        .select('status')
        .eq('id', review_item_id)
        .maybeSingle();
      itemStage = (itemRow?.status as string | undefined) ?? null;
    }

    // For comment-added events, persist @mentions found in the comment HTML
    // into review_comment_mentions. The result drives a separate "X mentioned
    // you" email below and ensures mentioned recipients are part of the
    // notification set even when their per-assignee toggles are off.
    let mentionRecipients: PersistedMention[] = [];
    if (isComment && review_comment_id) {
      try {
        // Pull the canonical content from the DB (don't trust the client's
        // comment_content arg — it could lie about who was @-mentioned).
        const { data: stored } = await supabase
          .from('review_comments')
          .select('content')
          .eq('id', review_comment_id)
          .maybeSingle();
        const content = (stored?.content as string | undefined) ?? '';
        mentionRecipients = await syncCommentMentions(supabase, {
          commentId: review_comment_id,
          content,
          projectId: project.id,
          actorEmail,
        });
      } catch (err) {
        console.error('Failed to sync comment mentions:', err);
      }
    }

    // Resolve recipient emails per the project's assignment + thread rules.
    const recipientEmails = await collectRecipients({
      supabase,
      projectId: project.id,
      companyId: project.company_id,
      reviewItemId: review_item_id ?? null,
      itemStage,
      eventType: event_type,
      isComment,
      isReply,
      isNewVersion,
      parentCommentId: parent_comment_id ?? null,
      projectClientEmail: project.client_email,
      excludeEmail: actorEmail,
    });

    // Send immediate "X mentioned you" emails (separate from the batched
    // comment digest) and remove those recipients from the batched set so
    // mentioned users don't get two emails for the same comment. We still
    // apply the internal-stage backstop: guests stay silent unless the
    // item is in a guest-visible stage.
    let mentioned = 0;
    if (mentionRecipients.length > 0) {
      const stageSafe = !itemStage || !isInternalStage(itemStage);

      // Pre-load guest prefs so @mention emails respect notify_comment toggles.
      const guestMentionEmails = mentionRecipients
        .filter((m) => m.targetKind === 'guest')
        .map((m) => m.targetEmail);
      const guestMentionPrefs = new Map<string, boolean>();
      if (guestMentionEmails.length > 0) {
        const { data: gRows } = await supabase
          .from('review_project_guest_recipients')
          .select('email, notify_comment, removed_at')
          .eq('review_project_id', project.id)
          .in('email', guestMentionEmails);
        for (const g of (gRows ?? []) as { email: string; notify_comment: boolean; removed_at: string | null }[]) {
          if (g.removed_at || g.notify_comment === false) {
            guestMentionPrefs.set(g.email.trim().toLowerCase(), false);
          }
        }
      }

      for (const m of mentionRecipients) {
        if (m.targetEmail === actorEmail) continue;
        if (m.targetKind === 'guest' && !stageSafe) continue;
        if (m.targetKind === 'guest' && guestMentionPrefs.get(m.targetEmail) === false) continue;
        try {
          const { subject, html } = buildMentionEmail({
            branding,
            projectTitle: project.title,
            reviewUrl,
            itemTitle: item_title ?? null,
            actorName: comment_author ?? null,
            commentContent: comment_content ?? null,
            mentionedName: m.displayName,
          });
          await getResend().emails.send({ from: FROM_EMAIL, to: m.targetEmail, subject, html });
          mentioned++;
          // Don't double-email this person via the digest queue.
          recipientEmails.delete(m.targetEmail);
        } catch (err) {
          console.error(`Failed to notify @mention ${m.targetEmail}:`, err);
        }
      }

      // In-app notifications for mentioned users (immediate, regardless of email outcome).
      try {
        const mentionEmails = mentionRecipients
          .filter((m) => m.targetEmail !== actorEmail)
          .map((m) => m.targetEmail);
        if (mentionEmails.length > 0) {
          const userIds = await resolveUserIdsForCompanyEmails(supabase, project.company_id, mentionEmails);
          if (userIds.length > 0) {
            await insertInAppNotifications({
              supabase,
              companyId: project.company_id,
              userIds,
              category: 'mention',
              title: `${comment_author || 'Someone'} mentioned you${item_title ? ` on ${item_title}` : ''}`,
              body: comment_content ? htmlToPlainText(comment_content).slice(0, 200) : null,
              link: `/feedback/${project.id}/board`,
            });
          }
        }
      } catch { /* Non-critical */ }
    }

    let sent = 0;
    let enqueued = 0;
    if (recipientEmails.size > 0) {
      if (isComment) {
        // Comments enqueue per recipient and flush via cron in a 5-min window.
        // We snapshot the screenshot URL + parent context now so the worker
        // can build the digest without re-fetching per recipient.
        let screenshotUrl: string | null = null;
        let parentAuthor: string | null = null;
        let parentContent: string | null = null;

        if (review_comment_id) {
          const { data: c } = await supabase
            .from('review_comments')
            .select('screenshot_url')
            .eq('id', review_comment_id)
            .maybeSingle();
          screenshotUrl = (c?.screenshot_url as string | null) ?? null;
        }
        if (isReply && parent_comment_id) {
          const { data: parent } = await supabase
            .from('review_comments')
            .select('author_name, content')
            .eq('id', parent_comment_id)
            .maybeSingle();
          parentAuthor = parent?.author_name ?? null;
          parentContent = parent?.content ?? null;
        }

        // The batched-digest email escapes its content (no rich rendering),
        // so we flatten any TipTap HTML to plain text before stashing it on
        // the queue row. New comments are HTML; legacy / widget-source
        // comments are already plain text and pass through unchanged.
        const plainContent = htmlToPlainText(comment_content ?? '');
        const plainParentContent = htmlToPlainText(parentContent ?? '');

        const rows = Array.from(recipientEmails).map((email) => ({
          recipient_email: email,
          company_id: project.company_id,
          review_project_id: project.id,
          review_item_id: review_item_id ?? null,
          review_comment_id: review_comment_id ?? null,
          event_type,
          payload: {
            item_title: item_title ?? null,
            comment_author: comment_author ?? null,
            comment_content: plainContent,
            screenshot_url: screenshotUrl,
            is_reply: isReply,
            parent_author: parentAuthor,
            parent_content: plainParentContent || null,
          },
        }));

        const { error: enqErr } = await supabase
          .from('pending_review_notifications')
          .insert(rows);
        if (enqErr) {
          console.error('Enqueue failed:', enqErr);
        } else {
          enqueued = rows.length;
        }

        // In-app notifications for comments appear immediately even though
        // the email is batched into a 5-min digest window.
        try {
          const commentUserIds = await resolveUserIdsForCompanyEmails(
            supabase, project.company_id, Array.from(recipientEmails),
          );
          if (commentUserIds.length > 0) {
            const inAppCategory: NotificationCategory = isReply ? 'comment_added' : 'comment_added';
            await insertInAppNotifications({
              supabase,
              companyId: project.company_id,
              userIds: commentUserIds,
              category: inAppCategory,
              title: `${comment_author || 'Someone'} commented${item_title ? ` on ${item_title}` : ''}`,
              body: comment_content ? htmlToPlainText(comment_content).slice(0, 200) : null,
              link: `/feedback/${project.id}/board`,
            });
          }
        } catch { /* Non-critical */ }
      } else {
        // Status / version events still send immediately — they're rarer and
        // don't benefit from batching.
        const { subject, html } = isNewVersion
          ? buildBrandedNewVersionEmail({
              branding,
              projectTitle: project.title,
              reviewUrl,
              itemTitle: item_title,
              versionAuthor: comment_author,
              versionNotes: comment_content,
            })
          : buildStatusEmail({
              branding,
              projectTitle: project.title,
              reviewUrl,
              dashboardUrl: appUrl,
              event:
                event_type === 'review_comment_resolved'
                  ? { kind: 'review_comment_resolved', resolvedBy: resolved_by, itemTitle: item_title }
                  : event_type === 'review_item_approved'
                  ? { kind: 'review_item_approved', itemTitle: item_title }
                  : event_type === 'review_item_revision_needed'
                  ? { kind: 'review_item_revision_needed', itemTitle: item_title }
                  : { kind: 'review_feedback_marked_complete', reviewer: comment_author, message: comment_content },
            });

        for (const email of Array.from(recipientEmails)) {
          try {
            await getResend().emails.send({ from: FROM_EMAIL, to: email, subject, html });
            sent++;
          } catch (err) {
            console.error(`Failed to notify ${email}:`, err);
          }
        }

        // In-app notifications for status / version events.
        try {
          const statusUserIds = await resolveUserIdsForCompanyEmails(
            supabase, project.company_id, Array.from(recipientEmails),
          );
          if (statusUserIds.length > 0) {
            const inAppCat: NotificationCategory =
              event_type === 'review_comment_resolved' ? 'comment_resolved'
              : event_type === 'review_item_approved' ? 'review_status'
              : event_type === 'review_item_revision_needed' ? 'review_status'
              : event_type === 'review_item_new_version' ? 'review_new_version'
              : 'review_complete';
            await insertInAppNotifications({
              supabase,
              companyId: project.company_id,
              userIds: statusUserIds,
              category: inAppCat,
              title: subject,
              body: comment_content ? htmlToPlainText(comment_content).slice(0, 200) : null,
              link: `/feedback/${project.id}/board`,
            });
          }
        } catch { /* Non-critical */ }

        try {
          await supabase.from('notification_log').insert({
            team_member_id: null as unknown as string,
            event_type,
            event_ref: `${event_type}_${Date.now()}`,
            company_id: project.company_id,
            review_project_id: project.id,
          });
        } catch (err) {
          console.error('Notification log insert failed:', err);
        }
      }
    }

    // Webhooks fire independently of email settings.
    try {
      await fireReviewWebhooks({
        event_type, company_id: project.company_id, custom_domain: verifiedDomain,
        project: { id: project.id, title: project.title, client_name: project.client_name, share_token: project.share_token },
        review_item_id, comment_author, comment_content, resolved_by, item_title,
      });
    } catch (err) {
      console.error('Review webhook dispatch error:', err);
    }

    return NextResponse.json({ sent, enqueued, mentioned, recipients: recipientEmails.size });
  } catch (err) {
    console.error('Review notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Recipients = assigned agency team members, plus:
//  - on replies: prior thread participants
//  - on new-version: the project's client_email + everyone who has commented
//    on the item in any earlier version
// The actor (comment author / resolver / version uploader) is excluded so
// they don't email themselves.
async function fireReviewWebhooks(payload: {
  event_type: ReviewEventType;
  company_id: string;
  custom_domain?: string | null;
  project: { id: string; title: string; client_name: string; share_token: string };
  review_item_id?: string;
  comment_author?: string;
  comment_content?: string;
  resolved_by?: string;
  item_title?: string;
}) {
  const supabase = createServiceClient();

  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('company_id', payload.company_id)
    .eq('enabled', true)
    .eq('event_type', payload.event_type);

  if (!webhooks || webhooks.length === 0) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const body = JSON.stringify({
    event: payload.event_type,
    timestamp: new Date().toISOString(),
    review_project: {
      id: payload.project.id,
      title: payload.project.title,
      client_name: payload.project.client_name,
      viewer_url: buildReviewUrl(payload.project.share_token, payload.custom_domain, appUrl),
    },
    ...(payload.review_item_id && { review_item_id: payload.review_item_id }),
    ...(payload.item_title && { item_title: payload.item_title }),
    ...(payload.comment_author && {
      comment: { author: payload.comment_author, content: payload.comment_content },
    }),
    ...(payload.resolved_by && { resolved_by: payload.resolved_by }),
  });

  for (const webhook of webhooks) {
    try {
      if (!isValidWebhookUrl(webhook.url)) {
        console.warn(`Skipping review webhook with invalid/private URL: ${webhook.url}`);
        continue;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AgencyViz-Webhooks/1.0',
      };

      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error(`Review webhook failed for ${webhook.url}:`, err);
    }
  }
}

async function collectRecipients(params: {
  supabase: ReturnType<typeof createServiceClient>;
  projectId: string;
  companyId: string;
  reviewItemId: string | null;
  itemStage: string | null;
  eventType: ReviewEventType;
  isComment: boolean;
  isReply: boolean;
  isNewVersion: boolean;
  parentCommentId: string | null;
  projectClientEmail: string | null;
  excludeEmail: string | null;
}): Promise<Set<string>> {
  const {
    supabase, projectId, companyId, reviewItemId, itemStage, eventType,
    isComment, isReply, isNewVersion,
    parentCommentId, projectClientEmail, excludeEmail,
  } = params;
  const recipients = new Set<string>();

  // Pick the per-assignee toggle column that gates this event.
  const prefColumn: string = isReply
    ? 'notify_reply'
    : isComment
    ? 'notify_comment'
    : eventType === 'review_comment_resolved'
    ? 'notify_resolve'
    : isNewVersion
    ? 'notify_new_version'
    : 'notify_status';

  // Assigned agency team members get the event when their toggle is on AND
  // (their `stages` array is empty — "all stages", back-compat — or includes
  // the item's current stage).
  const { data: assignees } = await supabase
    .from('review_project_assignees')
    .select('stages, team_member:team_members(email)')
    .eq('review_project_id', projectId)
    .eq(prefColumn, true);

  for (const row of (assignees ?? []) as unknown as Array<{
    stages: string[] | null;
    team_member: { email: string | null } | { email: string | null }[] | null;
  }>) {
    // Stage scope: skip assignees who limited themselves to specific stages
    // that don't include the current item stage. Project-level events with
    // no item (itemStage === null) bypass the scope filter.
    if (
      itemStage &&
      row.stages &&
      row.stages.length > 0 &&
      !row.stages.includes(itemStage)
    ) {
      continue;
    }
    // Supabase types the joined relation as either an array or a single
    // object depending on inference; normalise both shapes.
    const rel = row.team_member;
    const teamMembers = Array.isArray(rel) ? rel : rel ? [rel] : [];
    for (const tm of teamMembers) {
      const email = tm?.email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  // Replies also notify guests who participated in that thread (the parent
  // comment's author + any earlier replier on it).
  if (isComment && isReply && parentCommentId) {
    const { data: parent } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('id', parentCommentId)
      .maybeSingle();
    const parentEmail = parent?.author_email?.trim().toLowerCase();
    if (parentEmail) recipients.add(parentEmail);

    const { data: siblings } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('parent_comment_id', parentCommentId)
      .not('author_email', 'is', null);
    for (const row of siblings ?? []) {
      const email = (row as { author_email: string | null }).author_email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  // New-version notifications also pull in the project's client_email plus
  // anyone who has previously commented on the item — they're the people
  // who asked for the revisions.
  if (isNewVersion && reviewItemId) {
    const clientEmail = projectClientEmail?.trim().toLowerCase();
    if (clientEmail) recipients.add(clientEmail);

    const { data: itemAuthors } = await supabase
      .from('review_comments')
      .select('author_email')
      .eq('review_item_id', reviewItemId)
      .not('author_email', 'is', null);
    for (const row of itemAuthors ?? []) {
      const email = (row as { author_email: string | null }).author_email?.trim().toLowerCase();
      if (email) recipients.add(email);
    }
  }

  if (excludeEmail) recipients.delete(excludeEmail);

  // Apply guest-recipient overrides: if the project has stored prefs for
  // any of the (non-team-member) emails we collected, use them. Default
  // for emails with no row remains "all events on".
  await applyGuestPrefs({
    supabase,
    projectId,
    recipients,
    prefColumn: prefColumn as keyof GuestPrefRow,
    itemStage,
  });

  // Hard backstop: if the event targets an item currently in an internal
  // stage, drop every non-team-member recipient. This protects against any
  // path that adds a guest email outside of `review_project_guest_recipients`
  // (e.g. thread participants, project client_email on new versions).
  if (itemStage && isInternalStage(itemStage) && recipients.size > 0) {
    const { data: teamRows } = await supabase
      .from('team_members')
      .select('email')
      .eq('company_id', companyId)
      .in('email', Array.from(recipients));
    const teamEmails = new Set(
      (teamRows ?? [])
        .map((r) => (r as { email: string | null }).email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    );
    for (const email of Array.from(recipients)) {
      if (!teamEmails.has(email)) recipients.delete(email);
    }
  }

  return recipients;
}

type GuestPrefRow = {
  email: string;
  notify_comment: boolean;
  notify_reply: boolean;
  notify_resolve: boolean;
  notify_status: boolean;
  notify_new_version: boolean;
  removed_at: string | null;
};

async function applyGuestPrefs(params: {
  supabase: ReturnType<typeof createServiceClient>;
  projectId: string;
  recipients: Set<string>;
  prefColumn: keyof GuestPrefRow;
  itemStage: string | null;
}) {
  const { supabase, projectId, recipients, prefColumn, itemStage } = params;
  if (recipients.size === 0) return;

  const { data: rows } = await supabase
    .from('review_project_guest_recipients')
    .select('email, notify_comment, notify_reply, notify_resolve, notify_status, notify_new_version, removed_at, stages')
    .eq('review_project_id', projectId)
    .in('email', Array.from(recipients));

  for (const row of (rows ?? []) as (GuestPrefRow & { stages: string[] | null })[]) {
    const email = row.email.trim().toLowerCase();
    if (row.removed_at) {
      recipients.delete(email);
      continue;
    }
    if (row[prefColumn] === false) {
      recipients.delete(email);
      continue;
    }
    // Stage scoping for guests: when their `stages` array is non-empty and
    // the current item stage isn't in it, drop them. Project-level events
    // (itemStage === null) bypass the filter.
    if (
      itemStage &&
      row.stages &&
      row.stages.length > 0 &&
      !row.stages.includes(itemStage)
    ) {
      recipients.delete(email);
    }
  }
}


// Lightweight branded template for "@X mentioned you on <item>" emails.
// Kept inline because it's a single-purpose message that doesn't compose
// with the other branded templates in lib/review-notification-emails.ts.
function buildMentionEmail(args: {
  branding: EmailBranding;
  projectTitle: string;
  reviewUrl: string;
  itemTitle: string | null;
  actorName: string | null;
  commentContent: string | null;
  mentionedName: string;
}): { subject: string; html: string } {
  const actor = (args.actorName || 'Someone').trim();
  const item = args.itemTitle ? ` on ${args.itemTitle}` : '';
  const subject = `${actor} mentioned you${item}`;
  const preview = htmlToPlainText(args.commentContent ?? '').slice(0, 400);
  const accent = args.branding.accentColor;
  const logo = args.branding.logoUrl
    ? `<img src="${args.branding.logoUrl}" alt="${args.branding.companyName}" style="max-height:32px;margin-bottom:12px;" />`
    : '';
  const safePreview = preview
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f8f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">
    <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;">
      ${logo}
      <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">${escapeHtml(args.branding.companyName)} · ${escapeHtml(args.projectTitle)}</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">${escapeHtml(actor)} mentioned you${item ? ` <span style="color:#6b7280;font-weight:400;">on ${escapeHtml(args.itemTitle ?? '')}</span>` : ''}</h1>
      ${safePreview ? `<blockquote style="margin:0 0 20px;padding:12px 14px;border-left:3px solid ${accent};background:#f9fafb;border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:#374151;">${safePreview}</blockquote>` : ''}
      <a href="${args.reviewUrl}" style="display:inline-block;padding:10px 18px;background:${accent};color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Open the review</a>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">You're receiving this because ${escapeHtml(actor)} @-mentioned ${escapeHtml(args.mentionedName)}.</p>
    </div>
  </body></html>`;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
