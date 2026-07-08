// GHL API fetch helpers for Looker Studio data.
// All data is fetched live — nothing stored. Mirrors the Meta passthrough pattern.

import { ghlFetch, type GhlResult } from './client';
import type {
  GhlPipeline, GhlOpportunity, GhlContact, GhlCustomFieldDefinition,
  GhlInvoice, GhlEstimate,
} from './types';

// ── Types ───────────────────────────────────────────────────────────────

export interface GhlLocation {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface GhlLocationsSearchResponse {
  locations: GhlLocation[];
  count: number;
}

interface GhlOpportunitiesSearchResponse {
  opportunities: GhlOpportunity[];
  meta: { total: number; currentPage: number; nextPageUrl?: string; startAfterId?: string; startAfter?: number };
}

interface GhlContactsSearchResponse {
  contacts: GhlContact[];
  meta: { total: number; currentPage: number; nextPage?: string; startAfterId?: string; startAfter?: number };
}

interface GhlPipelinesResponse {
  pipelines: GhlPipeline[];
}

// ── Location listing (agency-level tokens only) ─────────────────────────

export async function listLocations(token: string): Promise<GhlResult<GhlLocation[]>> {
  const result = await ghlFetch<GhlLocationsSearchResponse>(token, '/locations/search', {
    method: 'GET',
    params: { limit: '100' },
  });

  if (!result.ok || !result.data) {
    return { ...result, data: null } as GhlResult<GhlLocation[]>;
  }

  return {
    ...result,
    data: result.data.locations.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
    })),
  };
}

// ── Pipeline listing ────────────────────────────────────────────────────

export async function listPipelinesForLocation(
  token: string,
  locationId: string,
): Promise<GhlResult<GhlPipeline[]>> {
  const result = await ghlFetch<GhlPipelinesResponse>(token, '/opportunities/pipelines', {
    method: 'GET',
    params: { locationId },
  });

  if (!result.ok || !result.data) {
    return { ...result, data: null } as GhlResult<GhlPipeline[]>;
  }

  return { ...result, data: result.data.pipelines };
}

// ── Opportunity fetching (paginated) ────────────────────────────────────

export interface FetchOpportunitiesParams {
  token: string;
  locationId: string;
  pipelineId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchAllOpportunities(
  params: FetchOpportunitiesParams,
): Promise<{ rows: GhlOpportunity[]; pipelines: Map<string, GhlPipeline> }> {
  const { token, locationId, pipelineId } = params;

  // Fetch pipelines first for stage name resolution
  const pipelinesResult = await listPipelinesForLocation(token, locationId);
  const pipelineMap = new Map<string, GhlPipeline>();
  if (pipelinesResult.ok && pipelinesResult.data) {
    for (const p of pipelinesResult.data) {
      pipelineMap.set(p.id, p);
    }
  }

  const allOpps: GhlOpportunity[] = [];
  let startAfterId: string | undefined;
  const MAX_PAGES = 50; // Safety cap

  for (let page = 0; page < MAX_PAGES; page++) {
    const queryParams: Record<string, string> = { locationId, limit: '100' };
    if (pipelineId) queryParams.pipelineId = pipelineId;
    if (startAfterId) queryParams.startAfterId = startAfterId;

    const result = await ghlFetch<GhlOpportunitiesSearchResponse>(
      token,
      '/opportunities/search',
      { method: 'GET', params: queryParams },
    );

    if (!result.ok || !result.data) break;

    const opps = result.data.opportunities;
    if (opps.length === 0) break;

    // Date filtering (GHL search doesn't support date range natively)
    const filtered = filterByDateRange(opps, params.dateFrom, params.dateTo);
    allOpps.push(...filtered);

    if (!result.data.meta?.startAfterId && !result.data.meta?.nextPageUrl) break;
    startAfterId = result.data.meta.startAfterId || opps[opps.length - 1]?.id;
    if (!startAfterId) break;
  }

  return { rows: allOpps, pipelines: pipelineMap };
}

// ── Contact fetching (paginated) ────────────────────────────────────────

export interface FetchContactsParams {
  token: string;
  locationId: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchAllContacts(
  params: FetchContactsParams,
): Promise<{ rows: GhlContact[] }> {
  const { token, locationId } = params;
  const allContacts: GhlContact[] = [];
  let startAfterId: string | undefined;
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const queryParams: Record<string, string> = { locationId, limit: '100' };
    if (startAfterId) queryParams.startAfterId = startAfterId;

    const result = await ghlFetch<GhlContactsSearchResponse>(
      token,
      '/contacts/',
      { method: 'GET', params: queryParams },
    );

    if (!result.ok || !result.data) break;

    const contacts = result.data.contacts;
    if (contacts.length === 0) break;

    const filtered = filterByDateRange(contacts, params.dateFrom, params.dateTo);
    allContacts.push(...filtered);

    if (!result.data.meta?.startAfterId && !result.data.meta?.nextPage) break;
    startAfterId = result.data.meta.startAfterId || contacts[contacts.length - 1]?.id;
    if (!startAfterId) break;
  }

  return { rows: allContacts };
}

// ── Custom Field Definitions ────────────────────────────────────────────

interface GhlCustomFieldsResponse {
  customFields: GhlCustomFieldDefinition[];
}

export async function listCustomFields(
  token: string,
  locationId: string,
  model?: string,
): Promise<GhlResult<GhlCustomFieldDefinition[]>> {
  const params: Record<string, string> = { locationId };
  if (model) params.model = model;

  const result = await ghlFetch<GhlCustomFieldsResponse>(
    token,
    '/locations/' + locationId + '/customFields',
    { method: 'GET', params },
  );

  if (!result.ok || !result.data) {
    return { ...result, data: null } as GhlResult<GhlCustomFieldDefinition[]>;
  }

  return { ...result, data: result.data.customFields };
}

// ── Invoice fetching (v3, offset-paginated) ────────────────────────────

interface GhlInvoicesListResponse {
  invoices: GhlInvoice[];
  total: number;
}

export interface FetchInvoicesParams {
  token: string;
  locationId: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchAllInvoices(
  params: FetchInvoicesParams,
): Promise<{ rows: GhlInvoice[] }> {
  const { token, locationId } = params;
  const allInvoices: GhlInvoice[] = [];
  const PAGE_SIZE = 100;
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const queryParams: Record<string, string> = {
      altId: locationId,
      altType: 'location',
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    };
    if (params.dateFrom) queryParams.startAt = params.dateFrom;
    if (params.dateTo) queryParams.endAt = params.dateTo;

    const result = await ghlFetch<GhlInvoicesListResponse>(
      token, '/invoices/', { method: 'GET', params: queryParams },
    );

    if (!result.ok || !result.data) break;

    const invoices = result.data.invoices;
    if (invoices.length === 0) break;
    allInvoices.push(...invoices);

    if (allInvoices.length >= result.data.total) break;
  }

  return { rows: allInvoices };
}

// ── Estimate fetching (v3, offset-paginated) ───────────────────────────

interface GhlEstimatesListResponse {
  estimates: GhlEstimate[];
  total: number;
}

export interface FetchEstimatesParams {
  token: string;
  locationId: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchAllEstimates(
  params: FetchEstimatesParams,
): Promise<{ rows: GhlEstimate[] }> {
  const { token, locationId } = params;
  const allEstimates: GhlEstimate[] = [];
  const PAGE_SIZE = 100;
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const queryParams: Record<string, string> = {
      altId: locationId,
      altType: 'location',
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    };
    if (params.dateFrom) queryParams.startAt = params.dateFrom;
    if (params.dateTo) queryParams.endAt = params.dateTo;

    const result = await ghlFetch<GhlEstimatesListResponse>(
      token, '/invoices/estimate/list', { method: 'GET', params: queryParams },
    );

    if (!result.ok || !result.data) break;

    const estimates = result.data.estimates;
    if (!Array.isArray(estimates) || estimates.length === 0) break;
    allEstimates.push(...estimates);

    if (allEstimates.length >= result.data.total) break;
  }

  return { rows: allEstimates };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function filterByDateRange<T extends { dateAdded?: string }>(
  items: T[],
  dateFrom?: string,
  dateTo?: string,
): T[] {
  if (!dateFrom && !dateTo) return items;
  const from = dateFrom ? new Date(dateFrom + 'T00:00:00Z').getTime() : 0;
  const to = dateTo ? new Date(dateTo + 'T23:59:59Z').getTime() : Infinity;

  return items.filter((item) => {
    if (!item.dateAdded) return true;
    const d = new Date(item.dateAdded).getTime();
    return d >= from && d <= to;
  });
}
