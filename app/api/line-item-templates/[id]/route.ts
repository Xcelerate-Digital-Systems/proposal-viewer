// app/api/line-item-templates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'line-item-templates/[id]');
    if (limited) return limited;


    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (typeof body.description === 'string') patch.description = body.description || null;
    if (Array.isArray(body.items)) patch.items = body.items;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('line_item_templates')
      .update(patch)
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .select('id, name, description, items, created_at')
      .single();

    if (error || !data) {
      console.error('[api/line-item-templates/[id]] PATCH:', error?.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('[api/line-item-templates/[id]] PATCH:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'line-item-templates/[id]');
    if (limited) return limited;


    const supabase = createServiceClient();
    const { error } = await supabase
      .from('line_item_templates')
      .delete()
      .eq('id', params.id)
      .eq('company_id', auth.companyId);

    if (error) {
      console.error('[api/line-item-templates/[id]] DELETE:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/line-item-templates/[id]] DELETE:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
