const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA4_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const GTM_BASE = 'https://www.googleapis.com/tagmanager/v2';
const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v25';

import type { AccessPlatform } from '@/lib/client-access/types';

export class GoogleApiError extends Error {
  readonly status: number;
  readonly googleError: unknown;
  constructor(status: number, body: unknown) {
    super(`Google API ${status}: ${JSON.stringify(body)}`);
    this.status = status;
    this.googleError = body;
  }
}

const PLATFORM_SCOPES: Record<string, string[]> = {
  google_ga4: ['https://www.googleapis.com/auth/analytics.manage.users'],
  google_gtm: ['https://www.googleapis.com/auth/tagmanager.manage.users'],
  google_ads: ['https://www.googleapis.com/auth/adwords'],
};

export function getScopesForPlatform(platform: AccessPlatform): string[] {
  return PLATFORM_SCOPES[platform] ?? [];
}

export function buildGoogleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const url = new URL(GOOGLE_OAUTH_BASE);
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', opts.scopes.join(' '));
  url.searchParams.set('state', opts.state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export async function exchangeGoogleCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new GoogleApiError(res.status, json);
  return json;
}

async function googleGet(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    throw new GoogleApiError(res.status, parsed);
  }
  return JSON.parse(text);
}

async function googlePost(url: string, accessToken: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    throw new GoogleApiError(res.status, parsed);
  }
  return text ? JSON.parse(text) : {};
}

// --- GA4 ---

export interface GA4AccountSummary {
  account: string;
  displayName: string;
  propertySummaries?: Array<{
    property: string;
    displayName: string;
  }>;
}

export async function fetchGA4AccountSummaries(accessToken: string): Promise<GA4AccountSummary[]> {
  const json = await googleGet(
    `${GA4_ADMIN_BASE}/accountSummaries?pageSize=200`,
    accessToken,
  ) as { accountSummaries?: GA4AccountSummary[] };
  return json.accountSummaries ?? [];
}

export async function grantGA4Access(opts: {
  accessToken: string;
  propertyId: string;
  agencyEmail: string;
}): Promise<void> {
  await googlePost(
    `${GA4_ADMIN_BASE}/${opts.propertyId}/accessBindings`,
    opts.accessToken,
    {
      user: opts.agencyEmail,
      roles: ['predefinedRoles/editor'],
    },
  );
}

// --- GTM ---

export interface GTMAccount {
  accountId: string;
  name: string;
  path: string;
}

export async function fetchGTMAccounts(accessToken: string): Promise<GTMAccount[]> {
  const json = await googleGet(
    `${GTM_BASE}/accounts?pageToken=`,
    accessToken,
  ) as { account?: GTMAccount[] };
  return json.account ?? [];
}

export async function grantGTMAccess(opts: {
  accessToken: string;
  accountPath: string;
  agencyEmail: string;
}): Promise<void> {
  await googlePost(
    `${GTM_BASE}/${opts.accountPath}/user_permissions`,
    opts.accessToken,
    {
      emailAddress: opts.agencyEmail,
      accountAccess: { permission: 'PUBLISH' },
    },
  );
}

// --- Google Ads ---

export interface GoogleAdsCustomer {
  resourceName: string;
  id: string;
  descriptiveName: string;
  manager: boolean;
}

export async function fetchCustomerDetails(
  accessToken: string,
  customerId: string,
): Promise<GoogleAdsCustomer | null> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not set');

  const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': devToken,
      'Content-Type': 'application/json',
      'login-customer-id': customerId,
    },
    body: JSON.stringify({
      query: `SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1`,
    }),
  });

  const text = await res.text();
  if (!res.ok) return null;

  let json: Record<string, unknown>;
  try { json = JSON.parse(text); } catch { return null; }

  const results = json.results as Array<{ customer?: { id?: string | number; descriptiveName?: string; manager?: boolean } }> | undefined;
  const row = results?.[0]?.customer;
  if (!row) return null;
  return {
    resourceName: `customers/${row.id}`,
    id: String(row.id),
    descriptiveName: row.descriptiveName || `Account ${row.id}`,
    manager: row.manager === true,
  };
}

export async function fetchAccessibleCustomers(accessToken: string): Promise<string[]> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not set');

  const res = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': devToken,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 500); }
    throw new GoogleApiError(res.status, parsed);
  }
  let json: Record<string, unknown>;
  try { json = JSON.parse(text); } catch { throw new Error(`listAccessibleCustomers returned non-JSON: ${text.slice(0, 300)}`); }
  return (json.resourceNames ?? []) as string[];
}

export async function createMccLink(opts: {
  accessToken: string;
  clientCustomerId: string;
  managerCustomerId: string;
}): Promise<string> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not set');

  // Create a CustomerClientLink from the manager (MCC) side.
  // The manager invites the client — this is the only way to create the link.
  // login-customer-id must be the MCC account.
  const res = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${opts.managerCustomerId}/customerClientLinks:mutate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'developer-token': devToken,
        'Content-Type': 'application/json',
        'login-customer-id': opts.managerCustomerId,
      },
      body: JSON.stringify({
        operation: {
          create: {
            clientCustomer: `customers/${opts.clientCustomerId}`,
            status: 'PENDING',
          },
        },
      }),
    },
  );

  const text = await res.text();
  let json: Record<string, unknown>;
  try { json = JSON.parse(text); } catch { throw new Error(`createMccLink non-JSON: ${text.slice(0, 300)}`); }
  if (!res.ok) throw new GoogleApiError(res.status, json);
  const result = json.result as Record<string, string> | undefined;
  return result?.resourceName ?? '';
}
