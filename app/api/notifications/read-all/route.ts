// app/api/notifications/read-all/route.ts
// Mark all notifications as read for the authenticated user.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', auth.member.user_id)
    .eq('company_id', auth.companyId)
    .is('read_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
