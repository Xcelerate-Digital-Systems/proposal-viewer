// Authenticated fetch wrapper for GoHighLevel API v2.
//
// Base URL: https://services.leadconnectorhq.com
// Auth: Authorization: Bearer <private_integration_token>
// Version header required on all requests.

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

export interface GhlRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

export interface GhlResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  rateLimited: boolean;
  retryAfterMs: number | null;
}

export async function ghlFetch<T>(
  token: string,
  path: string,
  options: GhlRequestOptions = {},
): Promise<GhlResult<T>> {
  const { method = 'GET', body, params } = options;

  let url = `${GHL_BASE_URL}${path}`;
  if (params) {
    const search = new URLSearchParams(params);
    url += `?${search.toString()}`;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Version': GHL_API_VERSION,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
    return {
      ok: false,
      status: 429,
      data: null,
      error: 'Rate limited by GoHighLevel',
      rateLimited: true,
      retryAfterMs: retryMs,
    };
  }

  if (!res.ok) {
    let errorMessage: string;
    try {
      const errBody = await res.json();
      errorMessage = errBody.message || errBody.error || `HTTP ${res.status}`;
    } catch {
      errorMessage = `HTTP ${res.status} ${res.statusText}`;
    }
    return {
      ok: false,
      status: res.status,
      data: null,
      error: errorMessage,
      rateLimited: false,
      retryAfterMs: null,
    };
  }

  const data = (await res.json()) as T;
  return {
    ok: true,
    status: res.status,
    data,
    error: null,
    rateLimited: false,
    retryAfterMs: null,
  };
}

export async function testGhlConnection(token: string, locationId?: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (locationId) {
    const result = await ghlFetch<{ location: { id: string; name: string } }>(
      token,
      `/locations/${locationId}`,
      { method: 'GET' },
    );

    if (result.ok) return { valid: true };
    if (result.status === 401) return { valid: false, error: 'Invalid API token' };
    if (result.status === 403) return { valid: false, error: 'Token does not have access to this location. Check your scopes include Locations (Read).' };
    if (result.status === 404) return { valid: false, error: 'Location ID not found. Double-check the ID in GHL → Settings → Business Profile.' };
    return { valid: false, error: result.error || 'Connection failed' };
  }

  const result = await ghlFetch<{ locations: Array<{ id: string; name: string }> }>(
    token,
    '/locations/search',
    { method: 'GET' },
  );

  if (result.ok) return { valid: true };
  if (result.status === 401) return { valid: false, error: 'Invalid API token' };
  return { valid: false, error: result.error || 'Connection failed' };
}
