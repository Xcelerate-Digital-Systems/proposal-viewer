// lib/oauth-clients/server.ts
//
// Server-side helpers for the generic OAuth2 authorization-code flow.
// Not used by the Chrome extension — that flow predates this module and
// continues to live under lib/oauth-extension/.

import { createHash, timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase-server';

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function getOAuthClient(clientId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('oauth_clients')
    .select('client_id, client_secret_hash, name, redirect_uris')
    .eq('client_id', clientId)
    .single();
  return data;
}

export function isRedirectUriAllowed(
  redirectUri: string,
  client: { redirect_uris: string[] },
): boolean {
  return client.redirect_uris.includes(redirectUri);
}
