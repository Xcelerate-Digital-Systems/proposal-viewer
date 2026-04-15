// Meta Graph API client for the AgencyViz connector.
// Stateless — every call fetches fresh from Meta. Designed to run inside a
// Vercel function; benchmark (scripts/benchmark-meta-passthrough.mjs) shows
// 24 months of daily data returns in ~5s on parallel(4).

import { META_API_VERSION, DEFAULT_INSIGHT_FIELDS, ALLOWED_INSIGHT_FIELDS } from './fields';

const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export class MetaApiError extends Error {
  readonly status: number;
  readonly metaError: unknown;
  readonly isAuthError: boolean;
  constructor(status: number, metaError: unknown) {
    super(`Meta API ${status}: ${JSON.stringify(metaError)}`);
    this.status = status;
    this.metaError = metaError;
    // Meta returns 401 for invalid tokens and 190 subcode for expired ones.
    // Both mean the user needs to re-auth.
    const code = (metaError as { error?: { code?: number } })?.error?.code;
    this.isAuthError = status === 401 || code === 190 || code === 102;
  }
}

async function graphGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    throw new MetaApiError(res.status, parsed);
  }
  return JSON.parse(text);
}

// --- OAuth helpers -----------------------------------------------------------

export function buildAuthorizeUrl(opts: {
  appId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const url = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', opts.appId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('state', opts.state);
  url.searchParams.set('scope', opts.scopes.join(','));
  return url.toString();
}

export async function exchangeCodeForToken(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; expires_in?: number }> {
  const json = await graphGet('/oauth/access_token', {
    client_id: opts.appId,
    client_secret: opts.appSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });
  return json as { access_token: string; expires_in?: number };
}

// Short-lived user tokens last ~1 hour. Exchange for a long-lived token that
// lasts ~60 days and can be refreshed by re-running the exchange.
export async function exchangeForLongLivedToken(opts: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const json = await graphGet('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: opts.appId,
    client_secret: opts.appSecret,
    fb_exchange_token: opts.shortLivedToken,
  });
  return json as { access_token: string; expires_in: number };
}

export async function fetchMeUser(accessToken: string): Promise<{ id: string; name?: string }> {
  const json = await graphGet('/me', { access_token: accessToken, fields: 'id,name' });
  return json as { id: string; name?: string };
}

export interface AdAccountSummary {
  id: string;                                 // act_XXXXX
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  business?: { id: string; name: string };
}

export async function fetchAdAccounts(accessToken: string): Promise<AdAccountSummary[]> {
  const accounts: AdAccountSummary[] = [];
  let url: string | null =
    `${BASE_URL}/me/adaccounts?${new URLSearchParams({
      access_token: accessToken,
      fields: 'id,account_id,name,currency,timezone_name,business{id,name}',
      limit: '100',
    })}`;
  while (url) {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      throw new MetaApiError(res.status, parsed);
    }
    const json = JSON.parse(text) as { data?: AdAccountSummary[]; paging?: { next?: string } };
    accounts.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return accounts;
}

// --- Insights ---------------------------------------------------------------

// Bounded parallel map — avoids slamming Meta with N simultaneous chunks.
async function mapPool<T, R>(items: T[], concurrency: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// Split a date range into <=maxDays chunks. Meta's insights endpoint can
// technically handle longer, but chunking gives us parallelism.
export function dateChunks(dateFrom: string, dateTo: string, maxDays = 60): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  let cursor = new Date(dateFrom);
  const end = new Date(dateTo);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push([cursor.toISOString().split('T')[0], chunkEnd.toISOString().split('T')[0]]);
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }
  return chunks;
}

export function validateFields(requested: string[] | undefined): string[] {
  if (!requested || requested.length === 0) return [...DEFAULT_INSIGHT_FIELDS];
  const invalid = requested.filter((f) => !ALLOWED_INSIGHT_FIELDS.has(f));
  if (invalid.length > 0) {
    throw new Error(`Unsupported fields: ${invalid.join(', ')}`);
  }
  return requested;
}

async function fetchInsightsChunk(opts: {
  accessToken: string;
  accountId: string;
  level: string;
  fields: string[];
  dateFrom: string;
  dateTo: string;
}): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let url: string | null = `${BASE_URL}/${opts.accountId}/insights?${new URLSearchParams({
    level: opts.level,
    fields: opts.fields.join(','),
    time_range: JSON.stringify({ since: opts.dateFrom, until: opts.dateTo }),
    time_increment: '1',
    limit: '500',
    access_token: opts.accessToken,
  })}`;

  while (url) {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      throw new MetaApiError(res.status, parsed);
    }
    const json = JSON.parse(text) as {
      data?: Record<string, unknown>[];
      paging?: { next?: string };
    };
    rows.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return rows;
}

export async function fetchInsights(opts: {
  accessToken: string;
  accountId: string;                          // act_XXXXX
  dateFrom: string;
  dateTo: string;
  fields?: string[];
  level?: 'ad' | 'adset' | 'campaign' | 'account';
  concurrency?: number;
}): Promise<{ rows: Record<string, unknown>[]; pages: number; elapsed_ms: number }> {
  const start = Date.now();
  const fields = validateFields(opts.fields);
  const level = opts.level ?? 'ad';
  const concurrency = opts.concurrency ?? 4;

  const chunks = dateChunks(opts.dateFrom, opts.dateTo, 60);
  const results = await mapPool(chunks, concurrency, ([from, to]) =>
    fetchInsightsChunk({
      accessToken: opts.accessToken,
      accountId: opts.accountId,
      level,
      fields,
      dateFrom: from,
      dateTo: to,
    }),
  );

  const rows = results.flat();
  return { rows, pages: chunks.length, elapsed_ms: Date.now() - start };
}
