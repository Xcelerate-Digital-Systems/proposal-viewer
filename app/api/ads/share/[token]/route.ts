// app/api/ads/share/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ads/share/[token]
 *
 * Public token-gated endpoint. Returns the ad tracker (treated as a "client"
 * in the UI) and every creative under it.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient();

  const { data: tracker, error: trackerErr } = await supabase
    .from('ad_trackers')
    .select('id, company_id, name, description, client_name, standards')
    .eq('share_token', params.token)
    .single();

  if (trackerErr || !tracker) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: creatives } = await supabase
    .from('ad_creatives')
    .select('*, ad_copy_variants(*)')
    .eq('tracker_id', tracker.id)
    .order('sort_order', { ascending: true });

  const { data: accountStandards } = await supabase
    .from('ad_account_standards')
    .select('*')
    .eq('company_id', tracker.company_id)
    .maybeSingle();

  return NextResponse.json({
    tracker: {
      id: tracker.id,
      name: tracker.name,
      description: tracker.description,
      client_name: tracker.client_name,
      standards: tracker.standards,
    },
    creatives: creatives ?? [],
    account_standards: accountStandards ?? null,
  });
}
