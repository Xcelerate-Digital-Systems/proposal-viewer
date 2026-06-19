// app/api/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getCompanyEntityDefaults } from '@/lib/company-defaults';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST — Create a blank template (PDF templates go through /api/templates/split).
// Applies company-level cover/branding defaults to the new record.
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'templates');
    if (limited) return limited;


    const supabase = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { name, description, entity_type } = body;

    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const resolvedEntityType: 'proposal' | 'quote' =
      entity_type === 'quote' ? 'quote' : 'proposal';

    const brandingDefaults = await getCompanyEntityDefaults(supabase, auth.companyId);

    const { data, error } = await supabase
      .from('proposal_templates')
      .insert({
        name,
        description:  description || null,
        company_id:   auth.companyId,
        entity_type:  resolvedEntityType,
        ...brandingDefaults,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[api/templates] POST insert:', error?.message);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, template_id: data.id });
  } catch (err) {
    console.error('Template POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const PROTECTED_FIELDS = new Set([
  'id', 'company_id', 'created_at', 'updated_at',
]);

function stripProtected<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!PROTECTED_FIELDS.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}

// PATCH — Update top-level fields on a template (e.g. page_order)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'templates');
    if (limited) return limited;


    const supabase = createServiceClient();
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('proposal_templates')
      .update(stripProtected(fields))
      .eq('id', id)
      .eq('company_id', auth.companyId);

    if (error) {
      console.error('[api/templates] PATCH:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Template PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
