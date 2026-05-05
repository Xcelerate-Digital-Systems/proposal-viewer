// lib/api-fetch.ts
// Shared client-side helper for calling our authenticated API routes.
// Reads the current Supabase session and attaches Authorization: Bearer <jwt>.

import { supabase } from './supabase';

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** fetch() with Supabase bearer auth attached. */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const auth = await getAuthHeader();
  const headers = { ...(init.headers as Record<string, string> | undefined), ...auth };
  return fetch(input, { ...init, headers });
}
