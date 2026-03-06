// app/api/member-badge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/member-badge?member_id=<uuid>
 *
 * Public endpoint — no auth required.
 * Returns the team member's name and a signed avatar URL for display
 * in the client-facing viewer (which runs unauthenticated / anon key
 * and cannot query team_members directly due to RLS).
 */
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('member_id');

  if (!memberId) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('name, avatar_path')
      .eq('id', memberId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    let avatarUrl: string | null = null;
if (data.avatar_path) {
  const { data: fileData } = await supabase.storage
    .from('proposals')
    .download(data.avatar_path);
  if (fileData) {
    const buffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mime = data.avatar_path.endsWith('.png') ? 'image/png' : 'image/jpeg';
    avatarUrl = `data:${mime};base64,${base64}`;
  }
}

return NextResponse.json(
  { name: data.name, avatar_url: avatarUrl },
  { headers: { 'Cache-Control': 'no-store' } }
);
  } catch (err) {
    console.error('member-badge API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}