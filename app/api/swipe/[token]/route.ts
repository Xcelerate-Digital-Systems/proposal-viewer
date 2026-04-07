// app/api/swipe/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * GET /api/swipe/[token]
 *
 * Resolves a swipe-file share token. Every swipe is publicly shareable via its
 * token — there is no separate "make public" toggle. The public viewer renders
 * the same detail layout as the admin-side popup.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data: file } = await supabase
      .from('swipe_files')
      .select('*')
      .eq('share_token', params.token)
      .maybeSingle();

    if (!file) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: type } = await supabase
      .from('swipe_types')
      .select('id, name')
      .eq('id', file.type_id)
      .maybeSingle();

    return NextResponse.json({ mode: 'file', file, type: type || null });
  } catch (err) {
    console.error('Swipe token resolver error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
