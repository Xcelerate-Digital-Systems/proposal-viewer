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

export async function GET(req: NextRequest) {
  try {
    const admin = await verifySuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('support_tickets')
      .select('*, companies(name)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error('[admin/support] list:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json(tickets ?? []);
  } catch (err) {
    console.error('[admin/support] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
