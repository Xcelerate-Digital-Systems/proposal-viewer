import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { authRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'templates/delete');
    if (limited) return limited;

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: template, error: fetchErr } = await supabase
      .from('proposal_templates')
      .select('id, cover_image_path')
      .eq('id', id)
      .eq('company_id', auth.companyId)
      .single();

    if (fetchErr || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: pages } = await supabase
      .from('template_pages_v2')
      .select('payload')
      .eq('template_id', id);

    if (pages && pages.length > 0) {
      const paths = pages
        .map((p) => (p.payload as Record<string, unknown>)?.file_path as string | undefined)
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from('proposals').remove(paths);
      }
    }

    if (template.cover_image_path) {
      await supabase.storage.from('proposals').remove([template.cover_image_path]);
    }

    const { error: deleteErr } = await supabase
      .from('proposal_templates')
      .delete()
      .eq('id', id)
      .eq('company_id', auth.companyId);

    if (deleteErr) {
      console.error('[api/templates/[id]] delete:', deleteErr.message);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Template delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
