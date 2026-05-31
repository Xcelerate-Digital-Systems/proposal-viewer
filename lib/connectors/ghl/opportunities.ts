// GoHighLevel Opportunities & Pipelines API helpers.

import { ghlFetch } from './client';
import type { GhlOpportunityResponse, GhlPipelinesResponse } from './types';

export async function listPipelines(token: string, locationId: string) {
  return ghlFetch<GhlPipelinesResponse>(token, '/opportunities/pipelines', {
    method: 'GET',
    params: { locationId },
  });
}

interface CreateOpportunityParams {
  locationId: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  name: string;
  monetaryValue?: number;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
}

export async function createOpportunity(
  token: string,
  params: CreateOpportunityParams,
) {
  const body: Record<string, unknown> = {
    locationId: params.locationId,
    pipelineId: params.pipelineId,
    pipelineStageId: params.pipelineStageId,
    contactId: params.contactId,
    name: params.name,
    status: params.status || 'open',
    source: 'AgencyViz',
  };
  if (params.monetaryValue != null) {
    body.monetaryValue = params.monetaryValue;
  }

  return ghlFetch<GhlOpportunityResponse>(token, '/opportunities/', {
    method: 'POST',
    body,
  });
}

interface UpdateOpportunityParams {
  pipelineStageId?: string;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
  monetaryValue?: number;
  name?: string;
}

export async function updateOpportunity(
  token: string,
  opportunityId: string,
  params: UpdateOpportunityParams,
) {
  const body: Record<string, unknown> = {};
  if (params.pipelineStageId) body.pipelineStageId = params.pipelineStageId;
  if (params.status) body.status = params.status;
  if (params.monetaryValue != null) body.monetaryValue = params.monetaryValue;
  if (params.name) body.name = params.name;

  return ghlFetch<GhlOpportunityResponse>(
    token,
    `/opportunities/${opportunityId}`,
    { method: 'PUT', body },
  );
}

export async function searchOpportunities(
  token: string,
  locationId: string,
  params?: { pipelineId?: string; contactId?: string },
) {
  const queryParams: Record<string, string> = { locationId };
  if (params?.pipelineId) queryParams.pipelineId = params.pipelineId;
  if (params?.contactId) queryParams.contact_id = params.contactId;

  return ghlFetch<{ opportunities: Array<{ id: string; name: string; pipelineStageId: string; status: string }> }>(
    token,
    '/opportunities/search',
    { method: 'GET', params: queryParams },
  );
}
