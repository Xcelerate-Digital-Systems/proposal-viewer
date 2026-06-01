import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit({ key: `support:messages:${auth.companyId}`, limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 20) });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const messageBody = body.body;

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, status')
      .eq('id', id)
      .eq('company_id', auth.companyId)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const { data: message, error } = await supabase
      .from('support_ticket_messages')
      .insert({
        ticket_id: id,
        sender_user_id: auth.member.user_id,
        sender_name: auth.member.name,
        is_admin_reply: false,
        body: messageBody.trim().slice(0, 10000),
      })
      .select()
      .single();

    if (error) {
      console.error('[support/tickets/messages] insert:', error.message);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await supabase
        .from('support_tickets')
        .update({ status: 'open', resolved_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json(message);
  } catch (err) {
    console.error('[support/tickets/[id]/messages] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
