import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.member.is_super_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const messageBody = body.body;

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('id', id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const { data: message, error } = await supabase
      .from('support_ticket_messages')
      .insert({
        ticket_id: id,
        sender_user_id: auth.member.user_id,
        sender_name: auth.member.name || 'Platform Admin',
        is_admin_reply: true,
        body: messageBody.trim().slice(0, 10000),
      })
      .select()
      .single();

    if (error) {
      console.error('[admin/support/messages] insert:', error.message);
      return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
    }

    await supabase
      .from('support_tickets')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'open');

    return NextResponse.json(message);
  } catch (err) {
    console.error('[admin/support/[id]/messages] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
