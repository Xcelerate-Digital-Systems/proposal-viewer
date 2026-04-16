// app/api/connectors/meta/data/route.ts
//
// Hot path — stateless passthrough to Meta. Called by the Apps Script Looker
// Studio connector during getData(). Auth via AgencyViz API key (av_live_...).
//
// Request body:
//   {
//     ad_account_id: "act_1234567890",
//     date_from: "2025-01-01",
//     date_to:   "2026-04-15",
//     fields?:     ["impressions","clicks",...],     // optional; validated whitelist
//     breakdowns?: ["age","publisher_platform",...], // optional; validated whitelist
//     level?:      "ad" | "adset" | "campaign" | "account"  // default "ad"
//   }
//
// Response:
//   { success: true, data: { rows, row_count, elapsed_ms, meta_pages } }
// or
//   { error: string, reauth_required?: true }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { fetchInsights, MetaApiError } from '@/lib/connectors/meta/api-client';
import { decryptToken } from '@/lib/connectors/meta/token-crypto';

export const dynamic = 'force-dynamic';
// Vercel default function timeout is fine (10s Hobby / 60s Pro). Benchmark
// shows 24 months @ parallel(4) in ~5s — well inside the 60s budget.
export const maxDuration = 60;

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Body must be JSON object');

  const { ad_account_id, date_from, date_to, fields, breakdowns, level } = body as Record<string, unknown>;

  if (typeof ad_account_id !== 'string' || !/^act_\d+$/.test(ad_account_id)) {
    return badRequest('ad_account_id must look like act_1234567890');
  }
  if (typeof date_from !== 'string' || !DATE_RE.test(date_from)) {
    return badRequest('date_from must be YYYY-MM-DD');
  }
  if (typeof date_to !== 'string' || !DATE_RE.test(date_to)) {
    return badRequest('date_to must be YYYY-MM-DD');
  }
  if (new Date(date_from) > new Date(date_to)) {
    return badRequest('date_from must be <= date_to');
  }
  if (fields !== undefined && (!Array.isArray(fields) || fields.some((f) => typeof f !== 'string'))) {
    return badRequest('fields must be an array of strings');
  }
  if (breakdowns !== undefined && (!Array.isArray(breakdowns) || breakdowns.some((b) => typeof b !== 'string'))) {
    return badRequest('breakdowns must be an array of strings');
  }
  if (level !== undefined && !['ad', 'adset', 'campaign', 'account'].includes(level as string)) {
    return badRequest('level must be one of ad|adset|campaign|account');
  }

  // Resolve the connected Meta account for this company.
  const supabase = createServiceClient();
  const { data: account } = await supabase
    .from('meta_ad_accounts')
    .select('connection_id, enabled, meta_connections!inner(id, company_id, status, access_token_encrypted, expires_at)')
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
  // Supabase types the joined relation as array | object depending on FK;
  // normalise to the object shape.
  const connection = Array.isArray(account.meta_connections)
    ? account.meta_connections[0]
    : account.meta_connections;
  if (!connection || connection.status !== 'active') {
    return NextResponse.json(
      { error: 'Meta connection is not active', reauth_required: true },
      { status: 401 },
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.access_token_encrypted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'decrypt failed';
    return NextResponse.json({ error: `Token decrypt failed: ${msg}` }, { status: 500 });
  }

  try {
    const result = await fetchInsights({
      accessToken,
      accountId: ad_account_id,
      dateFrom: date_from,
      dateTo: date_to,
      fields: fields as string[] | undefined,
      breakdowns: breakdowns as string[] | undefined,
      level: level as 'ad' | 'adset' | 'campaign' | 'account' | undefined,
      concurrency: 4,
    });

    // Fire-and-forget last_used_at update.
    supabase
      .from('meta_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', connection.id)
      .then(() => {});

    return NextResponse.json({
      success: true,
      data: {
        rows: result.rows,
        row_count: result.rows.length,
        elapsed_ms: result.elapsed_ms,
        meta_pages: result.pages,
      },
    });
  } catch (e) {
    if (e instanceof MetaApiError && e.isAuthError) {
      // Mark the connection so the UI can prompt for reconnect.
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
}
