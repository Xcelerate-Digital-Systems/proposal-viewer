// GHL sync enqueue helper.
// Called from proposal/quote stage change routes to enqueue async sync jobs.

import { createServiceClient } from '@/lib/supabase-server';
import type { GhlSyncPayload } from './types';

interface EnqueueParams {
  companyId: string;
  entityType: 'proposal' | 'quote';
  entityId: string;
  fromStage: string | null;
  toStage: string;
  payload: GhlSyncPayload;
}

export async function enqueueGhlSync(params: EnqueueParams): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Check if company has an enabled GHL connection
    const { data: connection } = await supabase
      .from('ghl_connections')
      .select('id, enabled, token_valid')
      .eq('company_id', params.companyId)
      .eq('enabled', true)
      .eq('token_valid', true)
      .maybeSingle();

    if (!connection) return;

    // Check if there's a mapping for this stage (not "do nothing")
    const { data: mapping } = await supabase
      .from('ghl_stage_mappings')
      .select('ghl_stage_id')
      .eq('company_id', params.companyId)
      .eq('entity_type', params.entityType)
      .eq('agencyviz_stage', params.toStage)
      .maybeSingle();

    if (!mapping?.ghl_stage_id) return;

    const idempotencyKey = `${params.entityType}:${params.entityId}:${params.toStage}:${Date.now()}`;

    await supabase.from('ghl_sync_jobs').insert({
      company_id: params.companyId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      event_type: 'stage_changed',
      from_stage: params.fromStage,
      to_stage: params.toStage,
      payload: params.payload,
      status: 'pending',
      idempotency_key: idempotencyKey,
    });
  } catch (err) {
    // Non-blocking: log and continue. Stage change must not fail because of GHL.
    console.error('[ghl-sync] Failed to enqueue sync job:', err);
  }
}

// Helper to extract sync payload from a proposal row
export function buildProposalSyncPayload(proposal: {
  title: string;
  client_name?: string | null;
  client_email?: string | null;
  client_organisation?: string | null;
}): GhlSyncPayload | null {
  if (!proposal.client_email) return null;

  return {
    client_email: proposal.client_email,
    client_name: proposal.client_name || '',
    client_organisation: proposal.client_organisation || undefined,
    entity_title: proposal.title || 'Untitled',
  };
}

// Helper to extract sync payload from a quote row
export function buildQuoteSyncPayload(quote: {
  title?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_organisation?: string | null;
  quote_total?: number | null;
}): GhlSyncPayload | null {
  if (!quote.client_email) return null;

  return {
    client_email: quote.client_email,
    client_name: quote.client_name || '',
    client_organisation: quote.client_organisation || undefined,
    entity_title: quote.title || 'Untitled Quote',
    monetary_value: quote.quote_total || undefined,
  };
}
