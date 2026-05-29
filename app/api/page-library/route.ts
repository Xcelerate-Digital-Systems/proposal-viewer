import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getEntityConfig } from '@/lib/page-types';
import type { EntityType } from '@/lib/page-types';

export const dynamic = 'force-dynamic';

// GET — list all library pages for the caller's company
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('page_library')
    .select('*')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[page-library] GET:', error.message);
    return NextResponse.json({ error: 'Failed to load library' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST — save a page from a proposal/template/document into the library
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { source_page_id, source_entity_type, label } = await req.json();

    if (!source_page_id || !source_entity_type) {
      return NextResponse.json(
        { error: 'source_page_id and source_entity_type are required' },
        { status: 400 },
      );
    }

    const validTypes: EntityType[] = ['proposal', 'document', 'template'];
    if (!validTypes.includes(source_entity_type)) {
      return NextResponse.json({ error: 'Invalid source_entity_type' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch source page
    const srcConfig = getEntityConfig(source_entity_type as EntityType);
    const { data: srcPage } = await supabase
      .from(srcConfig.pagesTable)
      .select('*')
      .eq('id', source_page_id)
      .maybeSingle();

    if (!srcPage) {
      return NextResponse.json({ error: 'Source page not found' }, { status: 404 });
    }

    // Verify source entity belongs to caller's company
    const entityId = srcPage[srcConfig.idColumn];
    const entityTable = source_entity_type === 'template'
      ? 'proposal_templates'
      : source_entity_type === 'document'
        ? 'documents'
        : 'proposals';
    const { data: srcEntity } = await supabase
      .from(entityTable)
      .select('company_id')
      .eq('id', entityId)
      .eq('company_id', auth.companyId)
      .maybeSingle();

    if (!srcEntity) {
      return NextResponse.json({ error: 'Source page not found' }, { status: 404 });
    }

    let payload = (srcPage.payload ?? {}) as Record<string, unknown>;

    // For PDF pages, copy the storage file into a library namespace
    if (srcPage.type === 'pdf' && payload.file_path) {
      const srcPath = payload.file_path as string;
      const ext = srcPath.split('.').pop() || 'pdf';
      const destPath = `page-library/${auth.companyId}/${Date.now()}.${ext}`;

      const { error: copyErr } = await supabase.storage
        .from('proposals')
        .copy(srcPath, destPath);

      if (copyErr) {
        console.error('[page-library] storage copy failed:', copyErr.message);
        return NextResponse.json({ error: 'Failed to copy page file' }, { status: 500 });
      }

      payload = { ...payload, file_path: destPath };
    }

    const row: Record<string, unknown> = {
      company_id:             auth.companyId,
      type:                   srcPage.type,
      title:                  srcPage.title,
      label:                  label?.trim() || null,
      indent:                 0,
      enabled:                true,
      position:               0,
      link_url:               srcPage.link_url ?? null,
      link_label:             srcPage.link_label ?? null,
      orientation:            srcPage.orientation ?? 'auto',
      show_title:             srcPage.show_title ?? true,
      show_member_badge:      srcPage.show_member_badge ?? false,
      show_client_logo:       srcPage.show_client_logo ?? false,
      prepared_by_member_id:  srcPage.prepared_by_member_id ?? null,
      payload,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('page_library')
      .insert(row)
      .select()
      .single();

    if (insertErr || !inserted) {
      console.error('[page-library] insert:', insertErr?.message);
      return NextResponse.json({ error: 'Failed to save to library' }, { status: 500 });
    }

    return NextResponse.json({ success: true, page: inserted });
  } catch (err) {
    console.error('[page-library] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — rename / update a page in the library
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, title, label } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof title === 'string' && title.trim()) updates.title = title.trim();
    if (typeof label === 'string') updates.label = label.trim() || null;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('page_library')
      .update(updates)
      .eq('id', id)
      .eq('company_id', auth.companyId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[page-library] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove a page from the library
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();

    // Fetch to get payload for storage cleanup
    const { data: page } = await supabase
      .from('page_library')
      .select('payload')
      .eq('id', id)
      .eq('company_id', auth.companyId)
      .maybeSingle();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Clean up storage file if PDF
    const filePath = (page.payload as Record<string, unknown>)?.file_path as string | undefined;
    if (filePath) {
      await supabase.storage.from('proposals').remove([filePath]);
    }

    const { error } = await supabase
      .from('page_library')
      .delete()
      .eq('id', id)
      .eq('company_id', auth.companyId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[page-library] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
