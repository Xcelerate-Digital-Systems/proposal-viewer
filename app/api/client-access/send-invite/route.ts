import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';
import { sendAccessInviteEmail } from '@/lib/client-access/emails';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limited = await authRateLimit(auth.companyId, 'client-access-invite');
  if (limited) return limited;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { access_url, client_email, client_name, notes } = body as {
    access_url?: string;
    client_email?: string;
    client_name?: string | null;
    notes?: string | null;
  };

  if (!access_url || !client_email) {
    return NextResponse.json({ error: 'access_url and client_email are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', auth.companyId)
    .single();

  const agencyName = company?.name ?? 'Your Agency';

  // Extract share_token from access_url to find the request ID
  const tokenMatch = access_url.match(/\/access\/([a-f0-9-]+)/);
  let requestId = '';
  if (tokenMatch) {
    const { data: accessReq } = await supabase
      .from('client_access_requests')
      .select('id')
      .eq('share_token', tokenMatch[1])
      .eq('company_id', auth.companyId)
      .single();
    requestId = accessReq?.id ?? '';
  }

  await sendAccessInviteEmail({
    to: client_email,
    agencyName,
    clientName: client_name ?? null,
    accessUrl: access_url,
    notes: notes ?? null,
    companyId: auth.companyId,
    requestId,
  });

  return NextResponse.json({ success: true });
}
