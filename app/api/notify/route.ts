import { NextRequest, NextResponse } from 'next/server';
import { sendNotifications } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_type, share_token, comment_id, comment_author, comment_content, resolved_by } = body;

    if (!event_type || !share_token) {
      return NextResponse.json({ error: 'Missing event_type or share_token' }, { status: 400 });
    }

    const validEvents = ['proposal_viewed', 'proposal_accepted', 'comment_added', 'comment_resolved'];
    if (!validEvents.includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    const result = await sendNotifications({
      event_type,
      share_token,
      comment_id,
      comment_author,
      comment_content,
      resolved_by,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}