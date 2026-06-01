// app/api/templates/rebuild-merged/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { rebuildTemplateMerged } from '@/lib/rebuild-template-merged';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/rebuild-merged
 *
 * Merges all template_pages into a single PDF and stores it as
 * proposal_templates.file_path.
 *
 * Body: { template_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { template_id } = body;

    if (!template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: tmpl } = await supabase
      .from('proposal_templates')
      .select('id')
      .eq('id', template_id)
      .eq('company_id', auth.companyId)
      .maybeSingle();
    if (!tmpl) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const filePath = await rebuildTemplateMerged(template_id);

    return NextResponse.json({
      file_path: filePath,
      success: true,
    });
  } catch (err) {
    console.error('Rebuild merged error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
