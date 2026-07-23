// app/api/workflow-templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// GET — List workflow templates for the company.
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'workflow-templates');
    if (limited) return limited;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('review_workflow_templates')
      .select('id, name, description, stages, default_stage_due_offsets, is_default, created_at, updated_at')
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/workflow-templates] GET:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, templates: data ?? [] });
  } catch (err) {
    console.error('[api/workflow-templates] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create a new workflow template.
// Body: { name, description?, stages, default_stage_due_offsets?, is_default? }
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'workflow-templates');
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    if (!Array.isArray(body.stages)) {
      return NextResponse.json({ error: 'stages array required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // If marking as default, unset any existing default for this company
    if (body.is_default) {
      await supabase
        .from('review_workflow_templates')
        .update({ is_default: false })
        .eq('company_id', auth.companyId)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('review_workflow_templates')
      .insert({
        company_id: auth.companyId,
        name: body.name.trim(),
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        stages: body.stages,
        default_stage_due_offsets: body.default_stage_due_offsets || {},
        is_default: !!body.is_default,
        created_by: auth.member.user_id ?? null,
      })
      .select('id, name, description, stages, default_stage_due_offsets, is_default, created_at, updated_at')
      .single();

    if (error || !data) {
      console.error('[api/workflow-templates] POST:', error?.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('[api/workflow-templates] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
