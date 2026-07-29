import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';
import { decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { ghlFetch } from '@/lib/connectors/ghl/client';
import type { GhlContact } from '@/lib/connectors/ghl/types';

export const dynamic = 'force-dynamic';

interface GhlContactsResponse {
  contacts: GhlContact[];
  meta?: { total?: number };
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await authRateLimit(auth.companyId, 'contacts/ghl-search');
  if (limited) return limited;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 10, 20);

  const supabase = createServiceClient();
  const { data: conn } = await supabase
    .from('ghl_connections')
    .select('api_token_encrypted, location_id, enabled')
    .eq('company_id', auth.companyId)
    .eq('enabled', true)
    .single();

  if (!conn) {
    return NextResponse.json({ contacts: [], connected: false });
  }

  let token: string;
  try {
    token = decryptGhlToken(conn.api_token_encrypted);
  } catch {
    return NextResponse.json({ contacts: [], connected: false });
  }

  const result = await ghlFetch<GhlContactsResponse>(token, '/contacts/', {
    method: 'GET',
    params: {
      locationId: conn.location_id,
      query: q,
      limit: String(limit),
    },
  });

  if (!result.ok || !result.data?.contacts) {
    return NextResponse.json({ contacts: [], connected: true });
  }

  const contacts = result.data.contacts.map((c) => ({
    id: c.id,
    email: c.email || null,
    name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || null,
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    phone: c.phone || null,
    organisation: c.companyName || null,
    tags: c.tags || [],
    source: 'ghl' as const,
  }));

  return NextResponse.json({ contacts, connected: true });
}
