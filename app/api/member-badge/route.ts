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
/** Download a storage path from the proposals bucket and return as a base64 data URL. */
async function pathToDataUrl(
  supabase: ReturnType<typeof createServiceClient>,
  storagePath: string,
): Promise<string | null> {
  const { data: fileData } = await supabase.storage.from('proposals').download(storagePath);
  if (!fileData) return null;
  const buffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const ext = storagePath.split('.').pop()?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('member_id');
  const path     = req.nextUrl.searchParams.get('path');

  if (!memberId && !path) {
    return NextResponse.json({ error: 'member_id or path required' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    // Direct storage path lookup — no DB query needed
    if (path) {
      const avatarUrl = await pathToDataUrl(supabase, path);
      if (!avatarUrl) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json(
        { avatar_url: avatarUrl },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Member ID lookup
    const { data, error } = await supabase
      .from('team_members')
      .select('name, avatar_path')
      .eq('id', memberId!)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const avatarUrl = data.avatar_path ? await pathToDataUrl(supabase, data.avatar_path) : null;

    return NextResponse.json(
      { name: data.name, avatar_url: avatarUrl },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('member-badge API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}