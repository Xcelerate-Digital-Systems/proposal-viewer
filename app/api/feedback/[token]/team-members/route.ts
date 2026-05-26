// app/api/feedback/[token]/team-members/route.ts
//
// Public endpoint that returns the bare-minimum team-member info needed to
// render avatars + names next to comments on a shared feedback project.
// Scoped by share_token / board_share_token so unauthenticated reviewers
// can pull avatars for *their* project's company without us exposing the
// authenticated /api/team-members surface.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    const supabase = createServiceClient();

    // Either share token (list/items + widget) or board_share_token (board) is valid.
    const { data: project } = await supabase
      .from('review_projects')
      .select('id, company_id')
      .or(`share_token.eq.${params.token},board_share_token.eq.${params.token}`)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ members: {} }, { headers: CORS_HEADERS });
    }

    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, name, avatar_path')
      .eq('company_id', project.company_id);

    const out: Record<string, { name: string; avatarUrl: string | null }> = {};
    for (const m of members || []) {
      if (!m.user_id) continue;
      let avatarUrl: string | null = null;
      if (m.avatar_path) {
        const { data: signed } = await supabase.storage
          .from('proposals')
          .createSignedUrl(m.avatar_path, 3600);
        avatarUrl = signed?.signedUrl ?? null;
      }
      out[m.user_id] = { name: m.name, avatarUrl };
    }

    return NextResponse.json(
      { members: out },
      // 5-minute browser cache — signed URLs are valid for an hour anyway.
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (err) {
    console.error('team-members public route error:', err);
    return NextResponse.json({ members: {} }, { headers: CORS_HEADERS });
  }
}
