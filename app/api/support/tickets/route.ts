import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[support/tickets] list:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json(tickets ?? []);
  } catch (err) {
    console.error('[support/tickets] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit({ key: `support:tickets:${auth.companyId}`, limit: 10, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 10) });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { subject, description, category } = body;

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const validCategories = ['general', 'billing', 'bug', 'feature_request', 'account'];
    const safeCategory = validCategories.includes(category) ? category : 'general';

    const supabase = createServiceClient();
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        company_id: auth.companyId,
        created_by_user_id: auth.member.user_id,
        created_by_name: auth.member.name,
        created_by_email: auth.member.email,
        subject: subject.trim().slice(0, 200),
        description: (description || '').trim().slice(0, 10000),
        category: safeCategory,
      })
      .select()
      .single();

    if (error) {
      console.error('[support/tickets] create:', error.message);
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    console.error('[support/tickets] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
