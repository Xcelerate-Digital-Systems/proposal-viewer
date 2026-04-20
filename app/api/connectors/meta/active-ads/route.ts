// app/api/connectors/meta/active-ads/route.ts
//
// Lists currently-active ads for a connected ad account so the user can pick
// which ones to import into an ad tracker. Sibling to /api/connectors/meta/data
// (the Looker Studio insights passthrough) — same auth + token-decrypt pattern.
//
// Query:
//   GET ?ad_account_id=act_1234567890&tracker_id=UUID
//
// Response:
//   { success: true, data: { ads: ActiveAd[], already_imported: string[] } }
// or
//   { error: string, reauth_required?: true }
//
// `already_imported` is the subset of meta_ad_ids we already have in this
// tracker — the UI hides these by default with a "Show N already imported"
// toggle.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { MetaApiError } from '@/lib/connectors/meta/api-client';
import { decryptToken } from '@/lib/connectors/meta/token-crypto';
import { fetchActiveAdsWithCreatives } from '@/lib/connectors/meta/ads-list';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ad_account_id = req.nextUrl.searchParams.get('ad_account_id');
  const tracker_id = req.nextUrl.searchParams.get('tracker_id');

  if (!ad_account_id || !/^act_\d+$/.test(ad_account_id)) {
    return NextResponse.json(
      { error: 'ad_account_id must look like act_1234567890' },
      { status: 400 },
    );
  }
  if (!tracker_id || !UUID_RE.test(tracker_id)) {
    return NextResponse.json({ error: 'tracker_id must be a UUID' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Resolve the connected Meta account for this company — same shape as /data.
  const { data: account } = await supabase
    .from('meta_ad_accounts')
    .select(
      'connection_id, enabled, meta_connections!inner(id, company_id, status, access_token_encrypted)',
    )
    .eq('ad_account_id', ad_account_id)
    .eq('meta_connections.company_id', auth.companyId)
    .single();

  if (!account) {
    return NextResponse.json(
      { error: 'Ad account not connected for this company' },
      { status: 404 },
    );
  }
  if (!account.enabled) {
    return NextResponse.json({ error: 'Ad account is disabled' }, { status: 403 });
  }

  const connection = Array.isArray(account.meta_connections)
    ? account.meta_connections[0]
    : account.meta_connections;
  if (!connection || connection.status !== 'active') {
    return NextResponse.json(
      { error: 'Meta connection is not active', reauth_required: true },
      { status: 401 },
    );
  }

  // Verify the tracker belongs to this company (prevents cross-tenant probing).
  const { data: tracker } = await supabase
    .from('ad_trackers')
    .select('id')
    .eq('id', tracker_id)
    .eq('company_id', auth.companyId)
    .single();
  if (!tracker) {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.access_token_encrypted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'decrypt failed';
    return NextResponse.json({ error: `Token decrypt failed: ${msg}` }, { status: 500 });
  }

  let ads;
  try {
    ads = await fetchActiveAdsWithCreatives({ accessToken, accountId: ad_account_id });
  } catch (e) {
    if (e instanceof MetaApiError && e.isAuthError) {
      await supabase
        .from('meta_connections')
        .update({ status: 'needs_reauth', updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return NextResponse.json(
        { error: 'Meta token is invalid or expired', reauth_required: true },
        { status: 401 },
      );
    }
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Find which of these ads we've already imported into this tracker.
  const adIds = ads.map((a) => a.meta_ad_id);
  let alreadyImported: string[] = [];
  if (adIds.length > 0) {
    const { data: existing } = await supabase
      .from('ad_creatives')
      .select('meta_ad_id')
      .eq('tracker_id', tracker_id)
      .in('meta_ad_id', adIds);
    alreadyImported = (existing ?? [])
      .map((row) => row.meta_ad_id)
      .filter((id): id is string => Boolean(id));
  }

  // Fire-and-forget last_used_at update.
  supabase
    .from('meta_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', connection.id)
    .then(() => {});

  return NextResponse.json({
    success: true,
    data: { ads, already_imported: alreadyImported },
  });
}
