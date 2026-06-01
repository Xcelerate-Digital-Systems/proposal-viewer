// app/api/notifications/read-all/route.ts
// Mark all notifications as read for the authenticated user.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', auth.member.user_id)
      .eq('company_id', auth.companyId)
      .is('read_at', null);

    if (error) {
      console.error('[api/notifications/read-all] POST:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/notifications/read-all] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
