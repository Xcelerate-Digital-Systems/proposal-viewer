// app/api/connectors/ghl/data/route.ts
//
// Hot path — stateless passthrough to GHL. Called by the Apps Script Looker
// Studio connector during getData(). Auth via AgencyViz API key (av_live_...).
//
// Request body:
//   {
//     location_id:  "abc123",
//     data_type:    "opportunities" | "contacts",
//     date_from:    "2026-01-01",
//     date_to:      "2026-07-08",
//     pipeline_id?: "pipe_123"    // optional, opportunities only
//   }
//
// Response:
//   { success: true, data: { rows, row_count, elapsed_ms } }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import {
  fetchAllOpportunities,
  fetchAllContacts,
} from '@/lib/connectors/ghl/looker-client';
import type { GhlPipeline } from '@/lib/connectors/ghl/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_DATA_TYPES = ['opportunities', 'contacts'] as const;
type DataType = (typeof VALID_DATA_TYPES)[number];

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Body must be JSON object');

  const { location_id, data_type, date_from, date_to, pipeline_id } = body as Record<string, unknown>;

  if (typeof location_id !== 'string' || !location_id.trim()) {
    return badRequest('location_id is required');
  }
  if (typeof data_type !== 'string' || !VALID_DATA_TYPES.includes(data_type as DataType)) {
    return badRequest('data_type must be "opportunities" or "contacts"');
  }
  if (typeof date_from !== 'string' || !DATE_RE.test(date_from)) {
    return badRequest('date_from must be YYYY-MM-DD');
  }
  if (typeof date_to !== 'string' || !DATE_RE.test(date_to)) {
    return badRequest('date_to must be YYYY-MM-DD');
  }
  if (new Date(date_from) > new Date(date_to)) {
    return badRequest('date_from must be <= date_to');
  }
  if (pipeline_id !== undefined && typeof pipeline_id !== 'string') {
    return badRequest('pipeline_id must be a string');
  }

  const supabase = createServiceClient();
  const { data: connection } = await supabase
    .from('ghl_agency_connections')
    .select('id, api_token_encrypted, token_valid')
    .eq('company_id', auth.companyId)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: 'No GHL agency connection found for this company' },
      { status: 404 },
    );
  }
  if (!connection.token_valid) {
    return NextResponse.json(
      { error: 'GHL agency token is invalid. Reconnect in Settings.', reauth_required: true },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = decryptGhlToken(connection.api_token_encrypted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'decrypt failed';
    return NextResponse.json({ error: `Token decrypt failed: ${msg}` }, { status: 500 });
  }

  const start = Date.now();

  try {
    if (data_type === 'opportunities') {
      const { rows, pipelines } = await fetchAllOpportunities({
        token,
        locationId: location_id,
        pipelineId: pipeline_id as string | undefined,
        dateFrom: date_from,
        dateTo: date_to,
      });

      // Enrich rows with resolved pipeline/stage names + flattened custom fields
      const enrichedRows = rows.map((opp) => {
        const pipeline = pipelines.get(opp.pipelineId);
        const stageName = pipeline?.stages?.find((s) => s.id === opp.pipelineStageId)?.name || '';
        const flat: Record<string, unknown> = {
          ...opp,
          pipelineName: pipeline?.name || '',
          stageName,
        };
        // Flatten custom fields to cf_<id> keys
        if (Array.isArray(opp.customFields)) {
          for (const cf of opp.customFields) {
            const val = cf.fieldValue;
            flat[`cf_${cf.id}`] = Array.isArray(val) ? val.join(', ') : (val ?? '');
          }
        }
        delete flat.customFields;
        return flat;
      });

      // Fire-and-forget last_used_at
      supabase
        .from('ghl_agency_connections')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', connection.id)
        .then(() => {});

      return NextResponse.json({
        success: true,
        data: {
          rows: enrichedRows,
          row_count: enrichedRows.length,
          elapsed_ms: Date.now() - start,
        },
      });
    }

    // contacts
    const { rows } = await fetchAllContacts({
      token,
      locationId: location_id,
      dateFrom: date_from,
      dateTo: date_to,
    });

    // Flatten custom fields on contacts
    const flatContacts = rows.map((contact) => {
      const flat: Record<string, unknown> = { ...contact };
      if (contact.customFields && typeof contact.customFields === 'object') {
        for (const [key, val] of Object.entries(contact.customFields)) {
          flat[`cf_${key}`] = Array.isArray(val) ? val.join(', ') : (val ?? '');
        }
      }
      delete flat.customFields;
      return flat;
    });

    supabase
      .from('ghl_agency_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', connection.id)
      .then(() => {});

    return NextResponse.json({
      success: true,
      data: {
        rows: flatContacts,
        row_count: flatContacts.length,
        elapsed_ms: Date.now() - start,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      await supabase
        .from('ghl_agency_connections')
        .update({ token_valid: false, updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return NextResponse.json(
        { error: 'GHL token is invalid or expired', reauth_required: true },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
