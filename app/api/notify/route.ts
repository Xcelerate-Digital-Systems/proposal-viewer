// app/api/notify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { sendNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

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
    const body = await req.json();
    const {
      event_type, share_token, comment_id, comment_author, comment_content,
      resolved_by, author_type, feedback_text, feedback_by,
    } = body;

    if (!event_type || !share_token) {
      return NextResponse.json({ error: 'Missing event_type or share_token' }, { status: 400 });
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
