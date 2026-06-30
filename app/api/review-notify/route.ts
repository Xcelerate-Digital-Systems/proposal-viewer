// app/api/review-notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { fromEmail } from '@/lib/resend';
import { sendAndLogEmail } from '@/lib/email-log';
import { buildReviewUrl } from '@/lib/proposal-url';
import { isInternalStage } from '@/lib/feedback/visibility';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  buildStatusEmail,
  buildNewVersionEmail as buildBrandedNewVersionEmail,
  withUnsubscribeLink,
  type EmailBranding,
} from '@/lib/review-notification-emails';
import { buildUnsubscribeUrl } from '@/lib/feedback/unsubscribe-token';
import { syncCommentMentions, type PersistedMention } from '@/lib/feedback/persist-mentions';
import { htmlToPlainText } from '@/lib/feedback/mention-html';
import { constantTimeEquals } from '@/lib/oauth-clients/server';
import type { NotificationCategory } from '@/lib/in-app-notifications';
import { collectRecipients } from '@/lib/review-notify/collect-recipients';
import { fireReviewWebhooks } from '@/lib/review-notify/fire-webhooks';
import { buildMentionEmail } from '@/lib/review-notify/mention-email';
import { dispatchInAppNotifications } from '@/lib/review-notify/dispatch-in-app';

const REVIEW_NOTIFY_LIMIT = 20;
const REVIEW_NOTIFY_WINDOW_SECONDS = 60;

// Allow up to 30s for large campaigns with many recipients.
export const maxDuration = 30;

type ReviewEventType =
  | 'review_comment_added'
  | 'review_comment_resolved'
  | 'review_item_approved'
  | 'review_item_revision_needed'
  | 'review_item_rejected'
  | 'review_feedback_marked_complete'
  | 'review_item_new_version';

export async function POST(req: NextRequest) {
  try {
    // Auth gate: accept either an internal server secret (server-to-server) or
    // a valid Supabase Bearer token (admin browser calls).
    const internalSecret = req.headers.get('x-internal-secret');
    const expectedSecret = process.env.INTERNAL_NOTIFY_SECRET;
    const hasInternalAuth =
      !!internalSecret &&
      !!expectedSecret &&
      constantTimeEquals(internalSecret, expectedSecret);

    let authedUserId: string | null = null;

    if (!hasInternalAuth) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const token = authHeader.slice(7);
      const authClient = createServiceClient();
      const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
      if (authErr || !user) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      authedUserId = user.id;
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
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
      author_user_id,
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
      author_user_id?: string;
    };

    if (!event_type || !share_token) {
      return NextResponse.json({ error: 'Missing event_type or share_token' }, { status: 400 });
    }

    const validEvents: ReviewEventType[] = [
      'review_comment_added', 'review_comment_resolved',
      'review_item_approved', 'review_item_revision_needed', 'review_item_rejected',
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

    // Cross-tenant check: if authed via Bearer token, verify the user
    // belongs to the company that owns this project.
    if (authedUserId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', authedUserId)
        .eq('company_id', project.company_id)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Validate that the review_comment_id belongs to this project
    // (either via its item's project, or directly via review_project_id).
    if (review_comment_id) {
      const { data: commentRow } = await supabase
        .from('review_comments')
        .select('id, review_item_id, review_project_id, review_items:review_item_id(review_project_id)')
        .eq('id', review_comment_id)
        .maybeSingle();

      let commentProjectId: string | null = null;
      if (commentRow?.review_item_id) {
        const rel = (commentRow as { review_items?: { review_project_id?: string } | { review_project_id?: string }[] }).review_items;
        const arr = Array.isArray(rel) ? rel : rel ? [rel] : [];
        commentProjectId = arr[0]?.review_project_id ?? null;
      } else {
        commentProjectId = (commentRow as { review_project_id?: string } | null)?.review_project_id ?? null;
      }

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

    // Resolve the actor's email. Prefer the client-supplied value, but fall
    // back to the canonical author_email stored on the comment row — this
    // guards against the client passing null/undefined.
    let actorEmail = (comment_author_email || '').trim().toLowerCase() || null;
    if (!actorEmail && review_comment_id) {
      const { data: commentRow } = await supabase
        .from('review_comments')
        .select('author_email')
        .eq('id', review_comment_id)
        .maybeSingle();
      actorEmail = commentRow?.author_email?.trim().toLowerCase() || null;
    }

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
          const unsub = buildUnsubscribeUrl(appUrl, project.id, m.targetEmail);
          await sendAndLogEmail({
            from: fromEmail(companyName), to: m.targetEmail, subject,
            html: withUnsubscribeLink(html, unsub),
            companyId: project.company_id,
            category: 'campaign_mention',
            eventType: 'mention',
            entityType: 'campaign',
            entityId: project.id,
          });
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
          await dispatchInAppNotifications({
            supabase,
            companyId: project.company_id,
            recipientEmails: mentionEmails,
            excludeUserId: author_user_id ?? null,
            category: 'mention',
            title: `${comment_author || 'Someone'} mentioned you${item_title ? ` on ${item_title}` : ''}`,
            body: comment_content ? htmlToPlainText(comment_content).slice(0, 200) : null,
            link: `/campaigns/${project.id}/board`,
          });
        }
      } catch { /* Non-critical */ }
    }

    let sent = 0;
    let enqueued = 0;
    if (recipientEmails.size > 0) {
      if (isComment) {
        // Comments enqueue per recipient and flush via cron in a 10-min window.
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
        // the email is batched into a 10-min digest window.
        try {
          await dispatchInAppNotifications({
            supabase,
            companyId: project.company_id,
            recipientEmails: Array.from(recipientEmails),
            excludeUserId: author_user_id ?? null,
            category: 'comment_added',
            title: `${comment_author || 'Someone'} commented${item_title ? ` on ${item_title}` : ''}`,
            body: comment_content ? htmlToPlainText(comment_content).slice(0, 200) : null,
            link: `/campaigns/${project.id}/board`,
          });
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
                  : event_type === 'review_item_rejected'
                  ? { kind: 'review_item_rejected', itemTitle: item_title, rejectedBy: resolved_by, reason: comment_content }
                  : { kind: 'review_feedback_marked_complete', reviewer: comment_author, message: comment_content },
            });

        for (const email of Array.from(recipientEmails)) {
          try {
            const unsub = buildUnsubscribeUrl(appUrl, project.id, email);
            await sendAndLogEmail({
              from: fromEmail(companyName), to: email, subject,
              html: withUnsubscribeLink(html, unsub),
              companyId: project.company_id,
              category: 'campaign_notification',
              eventType: event_type,
              entityType: 'campaign',
              entityId: project.id,
            });
            sent++;
          } catch (err) {
            console.error(`Failed to notify ${email}:`, err);
          }
        }

        // In-app notifications for status / version events.
        try {
          const inAppCat: NotificationCategory =
            event_type === 'review_comment_resolved' ? 'comment_resolved'
            : event_type === 'review_item_approved' ? 'review_status'
            : event_type === 'review_item_revision_needed' ? 'review_status'
            : event_type === 'review_item_rejected' ? 'review_status'
            : event_type === 'review_item_new_version' ? 'review_new_version'
            : 'review_complete';
          await dispatchInAppNotifications({
            supabase,
            companyId: project.company_id,
            recipientEmails: Array.from(recipientEmails),
            excludeUserId: author_user_id ?? null,
            category: inAppCat,
            title: subject,
            body: comment_content ? htmlToPlainText(comment_content).slice(0, 200) : null,
            link: `/campaigns/${project.id}/board`,
          });
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
