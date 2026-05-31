// GoHighLevel Contacts API helpers.

import { ghlFetch } from './client';
import type { GhlContactUpsertResponse } from './types';

interface UpsertContactParams {
  locationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  companyName?: string;
}

export async function upsertContact(
  token: string,
  params: UpsertContactParams,
) {
  const body: Record<string, unknown> = {
    locationId: params.locationId,
    email: params.email,
  };
  if (params.firstName) body.firstName = params.firstName;
  if (params.lastName) body.lastName = params.lastName;
  if (params.name) body.name = params.name;
  if (params.phone) body.phone = params.phone;
  if (params.companyName) body.companyName = params.companyName;

  return ghlFetch<GhlContactUpsertResponse>(token, '/contacts/upsert', {
    method: 'POST',
    body,
  });
}

export async function addContactToWorkflow(
  token: string,
  contactId: string,
  workflowId: string,
) {
  return ghlFetch<Record<string, unknown>>(
    token,
    `/contacts/${contactId}/workflow/${workflowId}`,
    { method: 'POST' },
  );
}
