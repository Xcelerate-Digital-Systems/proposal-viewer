import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.member.is_super_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .select('*, companies(name), support_ticket_messages(*)')
      .eq('id', id)
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (Array.isArray(ticket.support_ticket_messages)) {
      (ticket.support_ticket_messages as { created_at: string }[]).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }

    return NextResponse.json(ticket);
  } catch (err) {
    console.error('[admin/support/[id]] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const supabase = createServiceClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    const validPriorities = ['low', 'normal', 'high', 'urgent'];

    if (body.status && validStatuses.includes(body.status)) {
      updates.status = body.status;
      if (body.status === 'resolved') updates.resolved_at = new Date().toISOString();
      if (body.status === 'open') updates.resolved_at = null;
    }
    if (body.priority && validPriorities.includes(body.priority)) {
      updates.priority = body.priority;
    }

    const { error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[admin/support] patch:', error.message);
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/support/[id]] PATCH:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
