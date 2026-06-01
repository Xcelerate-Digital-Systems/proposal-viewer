// app/api/proposals/member-info/route.ts
//
// Returns a team member's display name + signed avatar URL for use on the
// public proposal viewer ("prepared by"). Public callers must pass a valid
// proposal share_token; we then resolve the proposal's company and only return
// members from that company. Authenticated admin callers may omit the token.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const memberId = req.nextUrl.searchParams.get('memberId');
    const shareToken = req.nextUrl.searchParams.get('share_token');
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    const supabase = createServiceClient();

    let companyId: string | null = null;

    if (req.headers.get('authorization')) {
      const auth = await getAuthContext(req);
      if (auth) companyId = auth.companyId;
    }

    if (!companyId && shareToken) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('company_id')
        .eq('share_token', shareToken)
        .maybeSingle();
      if (proposal?.company_id) companyId = proposal.company_id;
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: member } = await supabase
      .from('team_members')
      .select('name, avatar_path')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .single();

    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let avatarSignedUrl: string | null = null;
    if (member.avatar_path) {
      const { data: urlData } = await supabase.storage
        .from('proposals')
        .createSignedUrl(member.avatar_path, 3600);
      avatarSignedUrl = urlData?.signedUrl ?? null;
    }

    return NextResponse.json({ name: member.name, avatarSignedUrl });
  } catch (err) {
    console.error('[api/proposals/member-info] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
