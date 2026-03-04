// app/api/templates/rebuild-merged/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { rebuildTemplateMerged } from '@/lib/rebuild-template-merged';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/rebuild-merged
 *
 * Merges all template_pages into a single PDF and stores it as
 * proposal_templates.file_path. Can be called directly for backfilling
 * existing templates, or used as a manual rebuild trigger.
 *
 * Body: { template_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { template_id } = await req.json();

    if (!template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
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