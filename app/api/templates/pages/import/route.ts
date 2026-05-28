// app/api/templates/pages/import/route.ts
// Import pages from one template into another template.
// Body: { source_page_ids: string[], target_template_id: string }

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { importPages } from '@/lib/import-pages';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { source_page_ids, target_template_id } = await req.json();

    if (!Array.isArray(source_page_ids) || source_page_ids.length === 0 || !target_template_id) {
      return NextResponse.json(
        { error: 'source_page_ids (non-empty array) and target_template_id are required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Verify target template belongs to the caller's company
    const { data: tmpl } = await supabase
      .from('proposal_templates')
      .select('company_id')
      .eq('id', target_template_id)
      .eq('company_id', auth.companyId)
      .maybeSingle();

    if (!tmpl) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Verify all source pages belong to templates in the same company
    const { data: srcPages } = await supabase
      .from('template_pages_v2')
      .select('id, template_id')
      .in('id', source_page_ids);

    if (!srcPages?.length) {
      return NextResponse.json({ error: 'Source pages not found' }, { status: 404 });
    }

    const srcTemplateIds = Array.from(new Set(srcPages.map((p) => p.template_id)));
    const { data: srcTemplates } = await supabase
      .from('proposal_templates')
      .select('id')
      .in('id', srcTemplateIds)
      .eq('company_id', auth.companyId);

    if (!srcTemplates || srcTemplates.length !== srcTemplateIds.length) {
      return NextResponse.json({ error: 'Source pages not found' }, { status: 404 });
    }

    const result = await importPages(supabase, {
      sourcePageIds: source_page_ids,
      targetEntityId: target_template_id,
      targetCompanyId: auth.companyId,
      targetEntityType: 'template',
    });

    if (result.error && result.pages.length === 0) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ pages: result.pages, imported: result.pages.length });
  } catch (err) {
    console.error('[api/templates/pages/import] POST:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
