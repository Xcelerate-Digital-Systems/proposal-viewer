// app/api/cron/flush-review-notifications/route.ts
//
// Flush pending comment notifications older than their dispatch_after.
// Groups rows by (recipient_email, review_project_id) and sends a single
// digest email per group, then marks the rows dispatched.
//
// Triggered every minute by Vercel cron (see vercel.json `crons`).
// Vercel cron requests are authenticated via the `Authorization: Bearer <CRON_SECRET>`
// header — we reject anything that doesn't match (or admin Bearer tokens fall
// through to `getAuthContext` for manual triggering during local dev).

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';
import { getResend, fromEmail } from '@/lib/resend';
import { buildReviewUrl } from '@/lib/proposal-url';
import {
  buildCommentDigestEmail,
  withUnsubscribeLink,
  type DigestCommentEntry,
  type EmailBranding,
} from '@/lib/review-notification-emails';
import { buildUnsubscribeUrl } from '@/lib/feedback/unsubscribe-token';

export const dynamic = 'force-dynamic';

type PendingRow = {
  id: string;
  recipient_email: string;
  company_id: string;
  review_project_id: string;
  review_item_id: string | null;
  review_comment_id: string | null;
  event_type: string;
  payload: {
    item_title: string | null;
    comment_author: string | null;
    comment_content: string | null;
    screenshot_url: string | null;
    is_reply: boolean;
    parent_author: string | null;
    parent_content: string | null;
  };
  created_at: string;
};

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  // Pick rows that are due. Cap per run so we never time out.
  const { data: due, error } = await supabase
    .from('pending_review_notifications')
    .select('id, recipient_email, company_id, review_project_id, review_item_id, review_comment_id, event_type, payload, created_at')
    .is('dispatched_at', null)
    .lte('dispatch_after', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    console.error('flush-review-notifications: query failed', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ digests: 0, rows: 0 });
  }

  // Group by (recipient, project)
  const groups = new Map<string, PendingRow[]>();
  for (const row of due as PendingRow[]) {
    const key = `${row.recipient_email}::${row.review_project_id}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  // Cache project + company lookups across groups in this run.
  const projectCache = new Map<
    string,
    { title: string; share_token: string; custom_domain: string | null; domain_verified: boolean; company_id: string }
  >();
  const companyCache = new Map<string, EmailBranding>();

  let digestsSent = 0;
  let rowsDispatched = 0;

  for (const rows of Array.from(groups.values())) {
    const first = rows[0];
    let project = projectCache.get(first.review_project_id);
    if (!project) {
      const { data: p } = await supabase
        .from('review_projects')
        .select('title, share_token, custom_domain:companies(custom_domain), domain_verified:companies(domain_verified), company_id')
        .eq('id', first.review_project_id)
        .maybeSingle();
      // The joined columns come back nested; we don't actually need the
      // company columns here (they live on companies and we read them below).
      if (!p) continue;
      project = {
        title: (p as { title: string }).title,
        share_token: (p as { share_token: string }).share_token,
        custom_domain: null,
        domain_verified: false,
        company_id: (p as { company_id: string }).company_id,
      };
      projectCache.set(first.review_project_id, project);
    }

    let branding = companyCache.get(first.company_id);
    if (!branding) {
      const { data: c } = await supabase
        .from('companies')
        .select('name, logo_path, accent_color, custom_domain, domain_verified')
        .eq('id', first.company_id)
        .maybeSingle();
      const logoUrl = c?.logo_path
        ? supabase.storage.from('company-assets').getPublicUrl(c.logo_path as string).data.publicUrl
        : null;
      branding = {
        companyName: c?.name || 'Your agency',
        accentColor: (c?.accent_color as string) || '#017C87',
        logoUrl,
      };
      companyCache.set(first.company_id, branding);

      // Cache the verified domain for buildReviewUrl while we have it.
      if (project) {
        project.custom_domain = (c?.custom_domain as string | null) ?? null;
        project.domain_verified = !!c?.domain_verified;
      }
    }

    const verifiedDomain = project.domain_verified ? project.custom_domain : null;
    const reviewUrl = buildReviewUrl(project.share_token, verifiedDomain, appUrl);

    const entries: DigestCommentEntry[] = rows.map((r) => ({
      author: r.payload.comment_author || 'Someone',
      content: r.payload.comment_content || '',
      itemTitle: r.payload.item_title,
      screenshotUrl: r.payload.screenshot_url,
      isReply: !!r.payload.is_reply,
      parentAuthor: r.payload.parent_author,
      parentContent: r.payload.parent_content,
      createdAt: r.created_at,
    }));

    const { subject, html } = buildCommentDigestEmail({
      branding,
      projectTitle: project.title,
      reviewUrl,
      entries,
    });

    try {
      const unsub = buildUnsubscribeUrl(appUrl, first.review_project_id, first.recipient_email);
      await getResend().emails.send({
        from: fromEmail(branding.companyName),
        to: first.recipient_email,
        subject,
        html: withUnsubscribeLink(html, unsub),
      });
      digestsSent++;

      const ids = rows.map((r) => r.id);
      const { error: markErr } = await supabase
        .from('pending_review_notifications')
        .update({ dispatched_at: new Date().toISOString() })
        .in('id', ids);
      if (markErr) {
        console.error('flush-review-notifications: mark dispatched failed', markErr);
      } else {
        rowsDispatched += ids.length;
      }

      try {
        await supabase.from('notification_log').insert({
          team_member_id: null as unknown as string,
          event_type: 'review_comment_digest',
          event_ref: `digest_${first.review_project_id}_${Date.now()}`,
          company_id: first.company_id,
          review_project_id: first.review_project_id,
        });
      } catch (logErr) {
        console.error('notification_log insert failed:', logErr);
      }
    } catch (sendErr) {
      // Leave the rows un-dispatched so the next tick retries.
      console.error(`Failed to send digest to ${first.recipient_email}:`, sendErr);
    }
  }

  // Purge old dispatched rows (> 7 days) to prevent unbounded table growth.
  let purged = 0;
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stale } = await supabase
      .from('pending_review_notifications')
      .delete()
      .not('dispatched_at', 'is', null)
      .lt('dispatched_at', cutoff)
      .select('id');
    purged = stale?.length ?? 0;
  } catch (purgeErr) {
    console.error('flush-review-notifications: purge failed', purgeErr);
  }

  return NextResponse.json({ digests: digestsSent, rows: rowsDispatched, purged });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Vercel cron uses GET by default.
export async function GET(req: NextRequest) {
  return handle(req);
}
