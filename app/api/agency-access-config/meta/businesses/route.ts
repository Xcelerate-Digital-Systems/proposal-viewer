import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';
import { decryptToken } from '@/lib/connectors/meta/token-crypto';
import { fetchBusinesses } from '@/lib/connectors/meta/api-client';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { member, companyId } = auth;
  if (member.role !== 'owner' && member.role !== 'admin' && !member.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limited = await authRateLimit(companyId, 'agency-access-config');
  if (limited) return limited;

  const supabase = createServiceClient();
  const { data: config } = await supabase
    .from('agency_access_config')
    .select('meta_token_encrypted')
    .eq('company_id', companyId)
    .maybeSingle();

  if (!config?.meta_token_encrypted) {
    return NextResponse.json({ error: 'Meta not connected' }, { status: 404 });
  }

  let token: string;
  try {
    token = decryptToken(config.meta_token_encrypted);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt token' }, { status: 500 });
  }

  try {
    const businesses = await fetchBusinesses(token);
    return NextResponse.json({ businesses });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : 'unknown';
    console.error('[agency-access-config/meta/businesses]', msg);
    return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 502 });
  }
}
