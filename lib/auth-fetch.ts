// lib/auth-fetch.ts
// fetch() wrapper that attaches the current Supabase session's access token as
// a Bearer Authorization header. Used by client-side hooks that hit API routes
// guarded by getAuthContext() (e.g. /api/templates/pages — the proposal route
// is currently open, but matching the same auth shape is harmless).

import { supabase } from './supabase';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // getSession() reads the token from local storage without a network round-trip.
  // This is intentional for client-side use: the token is already validated on
  // every server-side API route via getAuthContext() → supabase.auth.getUser().
  // Using getUser() here would add ~200ms latency to every client-side fetch.
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}
