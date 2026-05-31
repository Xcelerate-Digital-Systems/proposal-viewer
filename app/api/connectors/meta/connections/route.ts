// app/api/connectors/meta/connections/route.ts
//
// Manage the lifecycle of a Meta connection from the AgencyViz admin UI.
// DELETE marks the connection as revoked and wipes the encrypted access token
// so it can no longer be used to call Meta on the company's behalf. The row
// is kept (not hard-deleted) so historical audit / last_used_at is preserved;
// the unique (company_id, meta_user_id) index still permits a fresh
// re-connection of the same Meta user later.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'manage_integrations');
  if (auth instanceof NextResponse) return auth;

  const rl = await rateLimit({ key: `meta:disconnect:${auth.companyId}`, limit: 5, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl, 5) });
  }

  let body: { connection_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { connection_id } = body;
  if (!connection_id) {
    return NextResponse.json({ error: 'connection_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Scope the update to the caller's company so no one can revoke another
  // company's connection by guessing an id.
  const { data, error } = await supabase
    .from('meta_connections')
    .update({
      status: 'revoked',
      access_token_encrypted: '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection_id)
    .eq('company_id', auth.companyId)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
