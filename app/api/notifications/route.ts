// app/api/notifications/route.ts
// List in-app notifications for the authenticated user.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);
    const unreadOnly = url.searchParams.get('unread') === '1';

    const supabase = createServiceClient();
    let query = supabase
      .from('in_app_notifications')
      .select('id, category, title, body, link, read_at, created_at')
      .eq('user_id', auth.member.user_id)
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[api/notifications] GET:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Unread count (always returned so the badge can update).
    const { count } = await supabase
      .from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.member.user_id)
      .eq('company_id', auth.companyId)
      .is('read_at', null);

    return NextResponse.json({ notifications: data ?? [], unread_count: count ?? 0 });
  } catch (err) {
    console.error('[api/notifications] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
