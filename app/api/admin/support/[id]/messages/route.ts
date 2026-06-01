import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: members } = await supabase
    .from('team_members')
    .select('id, user_id, name, email, is_super_admin')
    .eq('user_id', user.id)
    .eq('is_super_admin', true)
    .limit(1);
  return members?.[0] ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await verifySuperAdmin(req);
    if (!admin) {
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
        sender_user_id: admin.user_id,
        sender_name: admin.name || 'Platform Admin',
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
