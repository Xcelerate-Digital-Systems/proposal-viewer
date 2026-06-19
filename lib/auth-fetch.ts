// lib/auth-fetch.ts
// fetch() wrapper that attaches the current Supabase session's access token as
// a Bearer Authorization header. Used by client-side hooks that hit API routes
// guarded by getAuthContext() (e.g. /api/templates/pages — the proposal route
// is currently open, but matching the same auth shape is harmless).
// Also appends company context params so super-admin company switching and
// multi-workspace selection resolve correctly on the server.

import { supabase } from './supabase';

function withCompanyContext(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string') return input;
  try {
    const membershipId = localStorage.getItem('active_membership_id');
    const overrideRaw = localStorage.getItem('company_override');
    if (!membershipId && !overrideRaw) return input;

    const url = new URL(input, window.location.origin);
    if (membershipId && !url.searchParams.has('membership_id')) {
      url.searchParams.set('membership_id', membershipId);
    }
    if (overrideRaw) {
      const override = JSON.parse(overrideRaw) as { companyId: string };
      if (override.companyId && !url.searchParams.has('company_id')) {
        url.searchParams.set('company_id', override.companyId);
      }
    }
    return url.pathname + url.search;
  } catch {
    return input;
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  return fetch(withCompanyContext(input), { ...init, headers });
}
