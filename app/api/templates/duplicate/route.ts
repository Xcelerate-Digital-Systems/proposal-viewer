import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PROTECTED_FIELDS = new Set([
  'id', 'company_id', 'created_at', 'updated_at',
]);

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'templates/duplicate');
    if (limited) return limited;


    const body = await req.json().catch(() => null);
    if (!body?.template_id) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: source, error: fetchErr } = await supabase
      .from('proposal_templates')
      .select('*')
      .eq('id', body.template_id)
      .eq('company_id', auth.companyId)
      .single();

    if (fetchErr || !source) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      if (!PROTECTED_FIELDS.has(k)) fields[k] = v;
    }
    fields.company_id = auth.companyId;
    fields.name = `${source.name} (copy)`;
    fields.page_count = 0;

    const { data: newTemplate, error: insertErr } = await supabase
      .from('proposal_templates')
      .insert(fields)
      .select('id')
      .single();

    if (insertErr || !newTemplate) {
      console.error('[api/templates/duplicate] insert:', insertErr?.message);
      return NextResponse.json({ error: 'Failed to create duplicate' }, { status: 500 });
    }

    const { data: pages } = await supabase
      .from('template_pages_v2')
      .select('*')
      .eq('template_id', body.template_id)
      .order('page_number', { ascending: true });

    if (pages && pages.length > 0) {
      const newPages = pages.map(({ id, template_id, created_at, ...rest }) => ({
        ...rest,
        template_id: newTemplate.id,
      }));
      const { error: pagesErr } = await supabase.from('template_pages_v2').insert(newPages);
      if (pagesErr) {
        console.error('[api/templates/duplicate] pages:', pagesErr.message);
      }

      await supabase
        .from('proposal_templates')
        .update({ page_count: newPages.length })
        .eq('id', newTemplate.id);
    }

    return NextResponse.json({ success: true, template_id: newTemplate.id });
  } catch (err) {
    console.error('Template duplicate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
