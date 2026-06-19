// lib/api-fetch.ts
// Shared client-side helper for calling our authenticated API routes.
// Reads the current Supabase session and attaches Authorization: Bearer <jwt>.
// Automatically appends the effective company context (membership_id and/or
// company_id override) so server-side getAuthContext() resolves to the correct
// workspace — critical for super-admin company switching.

import { supabase } from './supabase';

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Append company context query params (?membership_id= and/or ?company_id=)
 * to a URL so server-side getAuthContext() resolves the correct workspace.
 */
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

/** fetch() with Supabase bearer auth and company context attached. */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const auth = await getAuthHeader();
  const headers = { ...(init.headers as Record<string, string> | undefined), ...auth };
  return fetch(withCompanyContext(input), { ...init, headers });
}
