// app/api/connectors/ghl/data/route.ts
//
// Hot path — stateless passthrough to GHL. Called by the Apps Script Looker
// Studio connector during getData(). Auth via AgencyViz OAuth.
//
// Returns a unified dataset: opportunities + contacts combined, each tagged
// with record_type so Looker Studio users can filter/group by type.
//
// Looks up the per-location token from ghl_looker_connections.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';
import { decryptGhlToken } from '@/lib/connectors/ghl/token-crypto';
import {
  fetchAllOpportunities,
  fetchAllContacts,
} from '@/lib/connectors/ghl/looker-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Body must be JSON object');

  const { location_id, date_from, date_to, pipeline_id } = body as Record<string, unknown>;

  if (typeof location_id !== 'string' || !location_id.trim()) {
    return badRequest('location_id is required');
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
    .from('ghl_looker_connections')
    .select('id, api_token_encrypted, token_valid')
    .eq('company_id', auth.companyId)
    .eq('location_id', location_id)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: 'No GHL connection found for this location. Connect it in AgencyViz first.' },
      { status: 404 },
    );
  }
  if (!connection.token_valid) {
    return NextResponse.json(
      { error: 'GHL token for this location is invalid. Reconnect at Integrations → Looker Studio.', ghl_token_invalid: true },
      { status: 502 },
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
    // Fetch opportunities and contacts in parallel
    const [oppResult, contactResult] = await Promise.all([
      fetchAllOpportunities({
        token,
        locationId: location_id,
        pipelineId: pipeline_id as string | undefined,
        dateFrom: date_from,
        dateTo: date_to,
      }),
      fetchAllContacts({
        token,
        locationId: location_id,
        dateFrom: date_from,
        dateTo: date_to,
      }),
    ]);

    const allRows: Record<string, unknown>[] = [];

    // Enrich opportunities
    for (const opp of oppResult.rows) {
      const pipeline = oppResult.pipelines.get(opp.pipelineId);
      const stageName = pipeline?.stages?.find((s) => s.id === opp.pipelineStageId)?.name || '';
      const flat: Record<string, unknown> = {
        ...opp,
        record_type: 'opportunity',
        pipelineName: pipeline?.name || '',
        stageName,
      };
      if (Array.isArray(opp.customFields)) {
        for (const cf of opp.customFields) {
          const val = cf.fieldValue;
          flat[`cf_${cf.id}`] = Array.isArray(val) ? val.join(', ') : (val ?? '');
        }
      }
      delete flat.customFields;
      allRows.push(flat);
    }

    // Enrich contacts
    for (const contact of contactResult.rows) {
      const flat: Record<string, unknown> = {
        ...contact,
        record_type: 'contact',
      };
      if (contact.customFields && typeof contact.customFields === 'object') {
        for (const [key, val] of Object.entries(contact.customFields)) {
          flat[`cf_${key}`] = Array.isArray(val) ? val.join(', ') : (val ?? '');
        }
      }
      delete flat.customFields;
      allRows.push(flat);
    }

    // Fire-and-forget last_used_at
    supabase
      .from('ghl_looker_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', connection.id)
      .then(() => {});

    return NextResponse.json({
      success: true,
      data: {
        rows: allRows,
        row_count: allRows.length,
        elapsed_ms: Date.now() - start,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      await supabase
        .from('ghl_looker_connections')
        .update({ token_valid: false, updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return NextResponse.json(
        { error: 'GHL token is invalid or expired. Reconnect at Integrations → Looker Studio.', ghl_token_invalid: true },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
