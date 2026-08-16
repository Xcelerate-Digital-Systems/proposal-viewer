import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { buildGoogleAuthorizeUrl } from '@/lib/connectors/google/api-client';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const STATE_TTL_SECONDS = 600;
const SCOPES = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.email',
];

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (auth.member.role !== 'owner' && auth.member.role !== 'admin' && !auth.member.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limited = await authRateLimit(auth.companyId, 'agency-access-config-google');
  if (limited) return limited;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!clientId || !appUrl) {
    return NextResponse.json({ error: 'Google connector not configured' }, { status: 500 });
  }

  const state = randomBytes(32).toString('base64url');
  const stateHash = createHash('sha256').update(state).digest('hex');
  const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString();

  const supabase = createServiceClient();

  const { error } = await supabase.from('meta_oauth_states').insert({
    state_hash: stateHash,
    company_id: auth.companyId,
    user_id: auth.member.user_id,
    redirect_to: '/client-access?tab=settings',
    expires_at: expiresAt,
  });

  if (error) {
    console.error('[agency-access-config/google] state insert:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const redirectUri = `${appUrl}/api/agency-access-config/google/callback`;
  const authorizeUrl = buildGoogleAuthorizeUrl({ clientId, redirectUri, state, scopes: SCOPES });

  return NextResponse.json({ authorize_url: authorizeUrl });
}
