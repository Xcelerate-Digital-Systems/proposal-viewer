// app/api/workflow-templates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'workflow-templates/[id]');
    if (limited) return limited;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('review_workflow_templates')
      .select('id, name, description, stages, default_stage_due_offsets, is_default, created_at, updated_at')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('[api/workflow-templates/[id]] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'workflow-templates/[id]');
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (body.description !== undefined) patch.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    if (Array.isArray(body.stages)) patch.stages = body.stages;
    if (body.default_stage_due_offsets !== undefined) patch.default_stage_due_offsets = body.default_stage_due_offsets;
    if (body.is_default !== undefined) patch.is_default = !!body.is_default;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // If marking as default, unset any existing default for this company
    if (patch.is_default === true) {
      await supabase
        .from('review_workflow_templates')
        .update({ is_default: false })
        .eq('company_id', auth.companyId)
        .eq('is_default', true);
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('review_workflow_templates')
      .update(patch)
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .select('id, name, description, stages, default_stage_due_offsets, is_default, created_at, updated_at')
      .single();

    if (error || !data) {
      console.error('[api/workflow-templates/[id]] PATCH:', error?.message);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('[api/workflow-templates/[id]] PATCH:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'workflow-templates/[id]');
    if (limited) return limited;

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('review_workflow_templates')
      .delete()
      .eq('id', params.id)
      .eq('company_id', auth.companyId);

    if (error) {
      console.error('[api/workflow-templates/[id]] DELETE:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/workflow-templates/[id]] DELETE:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
