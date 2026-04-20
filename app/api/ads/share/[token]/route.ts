// app/api/ads/share/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ads/share/[token]
 *
 * Public token-gated endpoint. Returns every ad creative across every tracker
 * owned by the client company whose ad_tracker_share_token matches [token].
 * Supports ?format=json to be explicit; the payload is the same either way.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient();

  const { data: client, error: clientErr } = await supabase
    .from('companies')
    .select('id, name, slug, logo_url, agency_id')
    .eq('ad_tracker_share_token', params.token)
    .eq('account_type', 'client')
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Trackers owned by this client. company_id on ad_trackers is the agency;
  // the link to the client is client_id.
  const { data: trackers } = await supabase
    .from('ad_trackers')
    .select('id, name, description, standards')
    .eq('client_id', client.id)
    .eq('company_id', client.agency_id);

  const trackerIds = (trackers ?? []).map((t: { id: string }) => t.id);

  const { data: creatives } = trackerIds.length
    ? await supabase
        .from('ad_creatives')
        .select('*, ad_copy_variants(*)')
        .in('tracker_id', trackerIds)
        .order('sort_order', { ascending: true })
    : { data: [] };

  const { data: accountStandards } = await supabase
    .from('ad_account_standards')
    .select('*')
    .eq('company_id', client.agency_id)
    .maybeSingle();

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      logo_url: client.logo_url,
    },
    trackers: trackers ?? [],
    creatives: creatives ?? [],
    account_standards: accountStandards ?? null,
  });
}
