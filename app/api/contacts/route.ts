// app/api/contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/contacts?q=search&limit=20
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 50);

  const supabase = createServiceClient();

  let query = supabase
    .from('contacts')
    .select('id, email, name, organisation, phone, source, created_at')
    .eq('company_id', auth.companyId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (q) {
    query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,organisation.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[api/contacts] GET:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ contacts: data ?? [] });
}

// POST /api/contacts — upsert a single contact
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const name = typeof body.name === 'string' ? body.name.trim() : null;
  const organisation = typeof body.organisation === 'string' ? body.organisation.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const source = typeof body.source === 'string' ? body.source : 'manual';

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      {
        company_id: auth.companyId,
        email,
        name: name || null,
        organisation: organisation || null,
        phone: phone || null,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,email' }
    )
    .select('id, email, name, organisation, phone')
    .single();

  if (error) {
    console.error('[api/contacts] POST:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}
