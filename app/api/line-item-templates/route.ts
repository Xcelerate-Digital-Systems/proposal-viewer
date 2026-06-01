// app/api/line-item-templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET — List line item templates for the current company.
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('line_item_templates')
      .select('id, name, description, items, created_at')
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/line-item-templates] GET:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, templates: data ?? [] });
  } catch (err) {
    console.error('[api/line-item-templates] GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Save a new line item template. Body: { name, description?, items[] }.
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('line_item_templates')
      .insert({
        company_id: auth.companyId,
        name: body.name.trim(),
        description: typeof body.description === 'string' ? body.description : null,
        items: body.items,
        created_by: auth.member.user_id ?? null,
      })
      .select('id, name, description, items, created_at')
      .single();

    if (error || !data) {
      console.error('[api/line-item-templates] POST:', error?.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err) {
    console.error('[api/line-item-templates] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
