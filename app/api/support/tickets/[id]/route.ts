import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await authRateLimit(auth.companyId, 'support/tickets/[id]');
    if (limited) return limited;

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .select('*, support_ticket_messages(*)')
      .eq('id', id)
      .eq('company_id', auth.companyId)
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
    console.error('[support/tickets/[id]] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
