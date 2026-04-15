// app/api/oauth/clients/validate/route.ts
//
// Unauthenticated endpoint used by the consent page to resolve a client_id
// to its display name and confirm the redirect_uri is allow-listed. Returns
// only data that's safe to show on a consent screen — no secrets.

import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient, isRedirectUriAllowed } from '@/lib/oauth-clients/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('client_id') || '';
  const redirectUri = req.nextUrl.searchParams.get('redirect_uri') || '';

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'client_id and redirect_uri required' }, { status: 400 });
  }

  const client = await getOAuthClient(clientId);
  if (!client) {
    return NextResponse.json({ error: 'Unknown client_id' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      client_id: client.client_id,
      name: client.name,
      redirect_allowed: isRedirectUriAllowed(redirectUri, client),
    },
  });
}
