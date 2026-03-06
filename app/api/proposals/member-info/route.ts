// app/api/proposals/member-info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('memberId');
  if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: member } = await supabase
    .from('team_members')
    .select('name, avatar_path')
    .eq('id', memberId)
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
}