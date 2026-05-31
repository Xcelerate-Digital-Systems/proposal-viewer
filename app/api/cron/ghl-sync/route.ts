// app/api/cron/ghl-sync/route.ts
//
// Background worker that processes GHL sync jobs. Dequeues pending jobs,
// calls GHL API (contact upsert → opportunity create/update → workflow trigger),
// handles retries with exponential backoff.
//
// Triggered every minute by Vercel cron (see vercel.json).
// Authenticated via CRON_SECRET Bearer token.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import { upsertContact, addContactToWorkflow } from '@/lib/connectors/ghl/contacts';
import { createOpportunity, updateOpportunity } from '@/lib/connectors/ghl/opportunities';
import type { GhlConnection, GhlStageMapping, GhlSyncJob, GhlSyncPayload } from '@/lib/connectors/ghl/types';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10;

// Exponential backoff schedule (seconds): 30s, 2m, 10m, 1h
const BACKOFF_SECONDS = [30, 120, 600, 3600];

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

function jitter(baseSeconds: number): number {
  const variance = baseSeconds * 0.2;
  return baseSeconds + (Math.random() * variance * 2 - variance);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Claim up to BATCH_SIZE pending jobs
  const { data: jobs } = await supabase
    .from('ghl_sync_jobs')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lt('next_attempt_at', now)
    .lt('attempts', 5)
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const job of jobs as GhlSyncJob[]) {
    // Mark as processing
    await supabase
      .from('ghl_sync_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id)
      .eq('status', job.status); // optimistic lock

    try {
      await processJob(supabase, job);
      processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextAttempt = job.attempts + 1;

      if (nextAttempt >= job.max_attempts) {
        // Dead letter
        await supabase
          .from('ghl_sync_jobs')
          .update({
            status: 'dead',
            attempts: nextAttempt,
            last_error: errorMsg,
          })
          .eq('id', job.id);
      } else {
        // Schedule retry with backoff
        const delaySecs = jitter(BACKOFF_SECONDS[Math.min(nextAttempt - 1, BACKOFF_SECONDS.length - 1)]);
        const nextAt = new Date(Date.now() + delaySecs * 1000).toISOString();

        await supabase
          .from('ghl_sync_jobs')
          .update({
            status: 'failed',
            attempts: nextAttempt,
            last_error: errorMsg,
            next_attempt_at: nextAt,
          })
          .eq('id', job.id);
      }

      console.error(`[ghl-sync] Job ${job.id} failed (attempt ${nextAttempt}):`, errorMsg);
    }
  }

  return NextResponse.json({ processed });
}

async function processJob(
  supabase: ReturnType<typeof createServiceClient>,
  job: GhlSyncJob,
) {
  const payload = job.payload as GhlSyncPayload | null;
  if (!payload?.client_email) {
    throw new Error('Job payload missing client_email');
  }

  // Get connection
  const { data: conn } = await supabase
    .from('ghl_connections')
    .select('*')
    .eq('company_id', job.company_id)
    .eq('enabled', true)
    .maybeSingle();

  if (!conn) {
    // Connection disabled or deleted — mark completed (no-op)
    await supabase
      .from('ghl_sync_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);
    return;
  }

  const connection = conn as GhlConnection;
  const token = decryptGhlToken(connection.api_token_encrypted);

  // Get stage mapping for this transition
  const { data: mapping } = await supabase
    .from('ghl_stage_mappings')
    .select('*')
    .eq('company_id', job.company_id)
    .eq('entity_type', job.entity_type)
    .eq('agencyviz_stage', job.to_stage)
    .maybeSingle();

  if (!mapping?.ghl_stage_id) {
    // No mapping — complete as no-op
    await supabase
      .from('ghl_sync_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);
    return;
  }

  const stageMapping = mapping as GhlStageMapping;

  // ── Step 1: Upsert contact ──────────────────────────────────────────

  const nameParts = (payload.client_name || '').trim().split(/\s+/);

  const contactResult = await upsertContact(token, {
    locationId: connection.location_id,
    email: payload.client_email,
    firstName: nameParts[0] || undefined,
    lastName: nameParts.slice(1).join(' ') || undefined,
    companyName: payload.client_organisation || undefined,
  });

  if (contactResult.rateLimited) {
    throw new Error(`Rate limited (retry after ${contactResult.retryAfterMs}ms)`);
  }
  if (!contactResult.ok || !contactResult.data) {
    if (contactResult.status === 401) {
      await supabase
        .from('ghl_connections')
        .update({ token_valid: false })
        .eq('id', connection.id);
      throw new Error('GHL token invalid (401)');
    }
    throw new Error(`Contact upsert failed: ${contactResult.error}`);
  }

  const contactId = contactResult.data.contact.id;

  await logAction(supabase, job, 'contact_upsert', '/contacts/upsert', contactResult.status, {
    contactId,
    isNew: contactResult.data.new,
  });

  // Store contact ID on the proposal/quote row
  await supabase
    .from('proposals')
    .update({ ghl_contact_id: contactId })
    .eq('id', job.entity_id);

  // ── Step 2: Create or update opportunity ─────────────────────────────

  // Both proposals and quotes live in the `proposals` table (entity_type differentiates)
  const table = 'proposals' as const;
  const { data: entity } = await supabase
    .from(table)
    .select('ghl_opportunity_id')
    .eq('id', job.entity_id)
    .maybeSingle();

  const existingOppId = entity?.ghl_opportunity_id;

  if (existingOppId) {
    // Update existing opportunity
    const updateParams: {
      pipelineStageId?: string;
      status?: 'open' | 'won' | 'lost' | 'abandoned';
      monetaryValue?: number;
    } = {
      pipelineStageId: stageMapping.ghl_stage_id!,
    };

    if (stageMapping.ghl_opp_status) {
      updateParams.status = stageMapping.ghl_opp_status as 'open' | 'won' | 'lost' | 'abandoned';
    }

    if (connection.sync_monetary_value && payload.monetary_value != null) {
      updateParams.monetaryValue = payload.monetary_value;
    }

    const updateResult = await updateOpportunity(token, existingOppId, updateParams);

    if (updateResult.rateLimited) {
      throw new Error('Rate limited on opportunity update');
    }
    if (!updateResult.ok) {
      if (updateResult.status === 404) {
        // Opportunity was deleted in GHL — clear reference and re-create next time
        await supabase.from(table).update({ ghl_opportunity_id: null }).eq('id', job.entity_id);
        throw new Error('Opportunity not found in GHL (deleted?) — will recreate on retry');
      }
      throw new Error(`Opportunity update failed: ${updateResult.error}`);
    }

    await logAction(supabase, job, 'opportunity_update', `/opportunities/${existingOppId}`, updateResult.status, {
      pipelineStageId: stageMapping.ghl_stage_id,
    });
  } else {
    // Create new opportunity
    const entityLabel = job.entity_type === 'proposal' ? 'Proposal' : 'Quote';
    const createResult = await createOpportunity(token, {
      locationId: connection.location_id,
      pipelineId: connection.pipeline_id,
      pipelineStageId: stageMapping.ghl_stage_id!,
      contactId,
      name: `[${entityLabel}] ${payload.entity_title}`,
      monetaryValue: connection.sync_monetary_value ? payload.monetary_value : undefined,
      status: (stageMapping.ghl_opp_status as 'open' | 'won' | 'lost' | 'abandoned') || 'open',
    });

    if (createResult.rateLimited) {
      throw new Error('Rate limited on opportunity create');
    }
    if (!createResult.ok || !createResult.data) {
      throw new Error(`Opportunity create failed: ${createResult.error}`);
    }

    const oppId = createResult.data.opportunity.id;

    // Store the opportunity ID on the entity
    await supabase
      .from(table)
      .update({
        ghl_opportunity_id: oppId,
        ghl_last_synced_at: new Date().toISOString(),
      })
      .eq('id', job.entity_id);

    await logAction(supabase, job, 'opportunity_create', '/opportunities/', createResult.status, {
      opportunityId: oppId,
    });
  }

  // ── Step 3: Trigger workflow (if enabled) ────────────────────────────

  if (
    connection.workflow_enabled &&
    connection.workflow_id &&
    stageMapping.trigger_workflow
  ) {
    const wfResult = await addContactToWorkflow(token, contactId, connection.workflow_id);

    if (!wfResult.ok && !wfResult.rateLimited) {
      // Log but don't fail the job — workflow trigger is secondary
      console.warn(`[ghl-sync] Workflow trigger failed for job ${job.id}: ${wfResult.error}`);
    }

    await logAction(supabase, job, 'workflow_trigger', `/contacts/${contactId}/workflow/${connection.workflow_id}`, wfResult.status, {
      success: wfResult.ok,
    });
  }

  // ── Mark completed ──────────────────────────────────────────────────

  await supabase
    .from('ghl_sync_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      attempts: job.attempts + 1,
    })
    .eq('id', job.id);
}

async function logAction(
  supabase: ReturnType<typeof createServiceClient>,
  job: GhlSyncJob,
  action: string,
  endpoint: string,
  responseStatus: number,
  responseSummary: Record<string, unknown>,
) {
  try {
    await supabase.from('ghl_sync_log').insert({
      company_id: job.company_id,
      job_id: job.id,
      entity_type: job.entity_type,
      entity_id: job.entity_id,
      action,
      ghl_endpoint: endpoint,
      response_status: responseStatus,
      response_body: responseSummary,
    });
  } catch {
    // Logging must never fail the job
  }
}
