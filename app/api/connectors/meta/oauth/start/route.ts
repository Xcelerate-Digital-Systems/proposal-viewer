// app/api/connectors/meta/oauth/start/route.ts
//
// Called by the in-app "Connect Facebook" button. Returns a Facebook OAuth
// authorize URL plus a CSRF state token. The caller then does
// `window.location.href = authorize_url` to redirect the user to Facebook.
//
// We don't 302 server-side because the request comes in with a Bearer token
// (Supabase session) — redirect responses lose the Authorization header anyway
// and the caller wants to do a top-level navigation, not a follow.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { buildAuthorizeUrl } from '@/lib/connectors/meta/api-client';
import { checkResourceLimit, buildLimitErrorBody } from '@/lib/billing/entitlements';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const STATE_TTL_SECONDS = 600;
const REQUIRED_SCOPES = ['ads_read', 'business_management'];

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'connectors/meta/oauth/start');
    if (limited) return limited;


    // Gate before the redirect — otherwise the user does the whole Facebook
    // OAuth dance only to be denied on callback. Done first so a denied
    // request never even mints a CSRF state row.
    const limitCheck = await checkResourceLimit(auth.companyId, 'meta_connections');
    if (!limitCheck.allowed) {
      return NextResponse.json(buildLimitErrorBody(limitCheck, 'meta_connections'), { status: 402 });
    }

    const appId = process.env.META_APP_ID;
    // Strip trailing slash — Meta's OAuth exchange compares redirect_uri strings
    // exactly, and a double-slash breaks the flow.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    if (!appId || !appUrl) {
      return NextResponse.json(
        { error: 'Meta connector is not configured (missing META_APP_ID or NEXT_PUBLIC_APP_URL)' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    // Only accept same-origin paths. Anything else — protocol-relative ("//x"),
    // absolute URLs, or strings starting with "@" — would let the callback land
    // the user on an attacker-controlled host when concatenated as
    // `${appUrl}${redirect_to}` and parsed by new URL().
    const rawRedirect = typeof body?.redirect_to === 'string' ? body.redirect_to : null;
    const redirectTo =
      rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes('\\')
        ? rawRedirect
        : null;

    const state = randomBytes(32).toString('base64url');
    const stateHash = createHash('sha256').update(state).digest('hex');
    const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString();

    const supabase = createServiceClient();
    const { error } = await supabase.from('meta_oauth_states').insert({
      state_hash: stateHash,
      company_id: auth.companyId,
      user_id: auth.member.user_id,
      redirect_to: redirectTo,
      expires_at: expiresAt,
    });
    if (error) {
      console.error('[api/connectors/meta/oauth/start] POST:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const redirectUri = `${appUrl}/api/connectors/meta/oauth/callback`;
    const authorizeUrl = buildAuthorizeUrl({
      appId,
      redirectUri,
      state,
      scopes: REQUIRED_SCOPES,
    });

    return NextResponse.json({
      success: true,
      authorize_url: authorizeUrl,
      expires_in: STATE_TTL_SECONDS,
    });
  } catch (err) {
    console.error('[api/connectors/meta/oauth/start] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
