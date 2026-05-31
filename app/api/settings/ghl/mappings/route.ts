// GET + POST /api/settings/ghl/mappings
// Load and save GHL stage mapping configuration.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

interface MappingEntry {
  entity_type: 'proposal' | 'quote';
  agencyviz_stage: string;
  ghl_stage_id: string | null;
  ghl_stage_name: string | null;
  ghl_opp_status: string | null;
  trigger_workflow: boolean;
}

interface SaveBody {
  pipeline_id: string;
  pipeline_name: string;
  mappings: MappingEntry[];
  workflow_id?: string | null;
  workflow_enabled?: boolean;
  sync_monetary_value?: boolean;
  enabled?: boolean;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: conn } = await supabase
    .from('ghl_connections')
    .select('id, pipeline_id, pipeline_name, workflow_id, workflow_enabled, sync_monetary_value, enabled, token_valid, location_id')
    .eq('company_id', auth.companyId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ success: true, data: { connection: null, mappings: [] } });
  }

  const { data: mappings } = await supabase
    .from('ghl_stage_mappings')
    .select('*')
    .eq('company_id', auth.companyId)
    .order('entity_type')
    .order('agencyviz_stage');

  return NextResponse.json({
    success: true,
    data: { connection: conn, mappings: mappings || [] },
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth || (auth.member?.role !== 'owner' && auth.member?.role !== 'admin' && !auth.member?.is_super_admin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as SaveBody;

  const supabase = createServiceClient();

  // Get connection
  const { data: conn } = await supabase
    .from('ghl_connections')
    .select('id')
    .eq('company_id', auth.companyId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: 'No GHL connection. Connect first.' }, { status: 404 });
  }

  // Update connection settings
  const { error: connError } = await supabase
    .from('ghl_connections')
    .update({
      pipeline_id: body.pipeline_id,
      pipeline_name: body.pipeline_name,
      workflow_id: body.workflow_id || null,
      workflow_enabled: body.workflow_enabled ?? false,
      sync_monetary_value: body.sync_monetary_value ?? true,
      enabled: body.enabled ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', auth.companyId);

  if (connError) {
    console.error('[api/settings/ghl/mappings] update connection:', connError.message);
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
  }

  // Upsert stage mappings
  if (body.mappings && body.mappings.length > 0) {
    const rows = body.mappings.map(m => ({
      company_id: auth.companyId,
      connection_id: conn.id,
      entity_type: m.entity_type,
      agencyviz_stage: m.agencyviz_stage,
      ghl_stage_id: m.ghl_stage_id || null,
      ghl_stage_name: m.ghl_stage_name || null,
      ghl_opp_status: m.ghl_opp_status || null,
      trigger_workflow: m.trigger_workflow ?? false,
      updated_at: new Date().toISOString(),
    }));

    const { error: mapError } = await supabase
      .from('ghl_stage_mappings')
      .upsert(rows, { onConflict: 'company_id,entity_type,agencyviz_stage' });

    if (mapError) {
      console.error('[api/settings/ghl/mappings] upsert mappings:', mapError.message);
      return NextResponse.json({ error: 'Failed to save mappings' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
