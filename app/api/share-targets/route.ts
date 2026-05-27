// app/api/share-targets/route.ts
//
// Returns the list of *other* companies the authenticated user is a team
// member of — i.e. companies the user could share swipe folders with. Used
// by the folder modal's "Share with" picker.
//
// Scoped to the auth context's currently-active company: the active company
// itself is excluded, since you don't share with yourself.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    const { data: memberships, error: memErr } = await supabase
      .from('team_members')
      .select('company_id')
      .eq('user_id', auth.member.user_id);

    if (memErr) {
      console.error('[api/share-targets] GET memberships:', memErr.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const otherIds = Array.from(
      new Set(
        (memberships || [])
          .map((m: { company_id: string }) => m.company_id)
          .filter((id: string) => id !== auth.companyId)
      )
    );

    if (otherIds.length === 0) return NextResponse.json({ success: true, data: [] });

    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', otherIds)
      .order('name', { ascending: true });

    if (error) {
      console.error('[api/share-targets] GET companies:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: companies || [] });
  } catch (err) {
    console.error('Share targets GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
