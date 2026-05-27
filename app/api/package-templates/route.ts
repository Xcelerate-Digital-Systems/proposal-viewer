// app/api/package-templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET — List package templates (single-tier) for the current company.
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('package_templates')
    .select('id, name, description, tier, created_at')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/package-templates] GET:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, templates: data ?? [] });
}

// POST — Save a new package template. Body: { name, description?, tier }.
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  if (!body.tier || typeof body.tier !== 'object') {
    return NextResponse.json({ error: 'tier object required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('package_templates')
    .insert({
      company_id: auth.companyId,
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description : null,
      tier: body.tier,
      created_by: auth.member.user_id ?? null,
    })
    .select('id, name, description, tier, created_at')
    .single();

  if (error || !data) {
    console.error('[api/package-templates] POST:', error?.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, template: data });
}
