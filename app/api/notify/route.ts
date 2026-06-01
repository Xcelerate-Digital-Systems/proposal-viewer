// app/api/notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { sendNotifications } from '@/lib/notifications';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const NOTIFY_LIMIT = 10;
const NOTIFY_WINDOW_SECONDS = 60;

// This endpoint is called by the public proposal viewer (no Supabase session).
// Authentication is via knowledge of the proposal's `share_token` — the same
// secret that grants viewing access. Beyond that, we enforce two extra checks
// to limit abuse for someone who has obtained a share_token:
//   1. The share_token must resolve to a real proposal (delegated to
//      sendNotifications which 404s otherwise).
//   2. If a comment_id is supplied, it must belong to that proposal — so an
//      attacker can't mint fake "comment_added" emails referencing rows that
//      don't exist.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const {
      event_type, share_token, comment_id, comment_author, comment_content,
      resolved_by, author_type, feedback_text, feedback_by,
    } = body;

    if (!event_type || !share_token) {
      return NextResponse.json({ error: 'Missing event_type or share_token' }, { status: 400 });
    }

    // Per-share_token throttle. Bounds inbox flooding even if a leaked
    // share_token is being exploited; legitimate viewer activity (1 view
    // ping + maybe an accept/decline + a few comments) is well under 10/min.
    const rl = await rateLimit({
      key: `notify:${share_token}`,
      limit: NOTIFY_LIMIT,
      windowSeconds: NOTIFY_WINDOW_SECONDS,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many notification triggers for this proposal' },
        { status: 429, headers: rateLimitHeaders(rl, NOTIFY_LIMIT) },
      );
    }

    const validEvents = [
      'proposal_viewed',
      'proposal_accepted',
      'proposal_declined',
      'proposal_revision_requested',
      'comment_added',
      'comment_resolved',
    ];
    if (!validEvents.includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    // Comment events MUST carry a comment_id. Otherwise notifications.ts
    // falls through to its `else` branch where event_ref becomes
    // `${event_type}_${Date.now()}` — unique on every call, so the
    // dedup lookup against notification_log never matches and the team
    // gets emailed once per request. Anyone with a leaked share_token
    // could flood inboxes / burn Resend quota that way.
    const isCommentEvent = event_type === 'comment_added' || event_type === 'comment_resolved';
    if (isCommentEvent && !comment_id) {
      return NextResponse.json(
        { error: 'comment_id is required for comment_added / comment_resolved events' },
        { status: 400 },
      );
    }

    if (comment_id) {
      const supabase = createServiceClient();
      const { data: proposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('share_token', share_token)
        .single();
      if (!proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }
      const { data: comment } = await supabase
        .from('proposal_comments')
        .select('id')
        .eq('id', comment_id)
        .eq('proposal_id', proposal.id)
        .maybeSingle();
      if (!comment) {
        return NextResponse.json(
          { error: 'comment_id does not belong to this proposal' },
          { status: 403 },
        );
      }
    }

    const result = await sendNotifications({
      event_type,
      share_token,
      comment_id,
      comment_author,
      comment_content,
      resolved_by,
      author_type: author_type || 'client',
      feedback_text,
      feedback_by,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
