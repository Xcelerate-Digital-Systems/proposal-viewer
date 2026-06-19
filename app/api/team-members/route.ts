// app/api/team-members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'team-members');
    if (limited) return limited;


    const { searchParams } = req.nextUrl;
    const memberId = searchParams.get('id');

    if (!memberId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Scope by company so a caller can't enumerate other tenants' members.
    const { data, error } = await supabase
      .from('team_members')
      .select('id, name, avatar_path')
      .eq('id', memberId)
      .eq('company_id', auth.companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let avatarUrl: string | null = null;
    if (data.avatar_path) {
      const { data: signed } = await supabase.storage
        .from('proposals')
        .createSignedUrl(data.avatar_path, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }

    return NextResponse.json(
      { id: data.id, name: data.name, avatarUrl },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('team-members route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
