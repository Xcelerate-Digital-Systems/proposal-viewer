import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getEntityConfig, rowToUnifiedPage } from '@/lib/page-types';
import type { EntityType } from '@/lib/page-types';

export const dynamic = 'force-dynamic';

// POST — import library pages into a target entity
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { library_page_ids, target_entity_id, target_entity_type } = await req.json();

    if (!Array.isArray(library_page_ids) || library_page_ids.length === 0) {
      return NextResponse.json({ error: 'library_page_ids required' }, { status: 400 });
    }
    if (!target_entity_id || !target_entity_type) {
      return NextResponse.json({ error: 'target_entity_id and target_entity_type required' }, { status: 400 });
    }

    const validTypes: EntityType[] = ['proposal', 'document', 'template'];
    if (!validTypes.includes(target_entity_type)) {
      return NextResponse.json({ error: 'Invalid target_entity_type' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { pagesTable, idColumn } = getEntityConfig(target_entity_type as EntityType);

    // Verify target belongs to caller's company
    const entityTable = target_entity_type === 'template'
      ? 'proposal_templates'
      : target_entity_type === 'document'
        ? 'documents'
        : 'proposals';
    const { data: targetEntity } = await supabase
      .from(entityTable)
      .select('company_id')
      .eq('id', target_entity_id)
      .eq('company_id', auth.companyId)
      .maybeSingle();

    if (!targetEntity) {
      return NextResponse.json({ error: 'Target entity not found' }, { status: 404 });
    }

    // Fetch library pages
    const { data: libPages } = await supabase
      .from('page_library')
      .select('*')
      .in('id', library_page_ids)
      .eq('company_id', auth.companyId)
      .order('created_at', { ascending: true });

    if (!libPages?.length) {
      return NextResponse.json({ error: 'Library pages not found' }, { status: 404 });
    }

    // Determine insert position
    const { data: lastPage } = await supabase
      .from(pagesTable)
      .select('position')
      .eq(idColumn, target_entity_id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextPosition = lastPage ? (lastPage.position as number) + 1 : 0;
    const inserted = [];

    for (const src of libPages) {
      let payload = (src.payload ?? {}) as Record<string, unknown>;

      // Copy storage file for PDF pages
      if (src.type === 'pdf' && payload.file_path) {
        const srcPath = payload.file_path as string;
        const ext = srcPath.split('.').pop() || 'pdf';
        const folder = target_entity_type === 'template' ? 'templates' : 'proposals';
        const destPath = `${folder}/${target_entity_id}/lib-${Date.now()}-${nextPosition}.${ext}`;

        const { error: copyErr } = await supabase.storage
          .from('proposals')
          .copy(srcPath, destPath);

        if (copyErr) {
          console.error('[page-library/import] copy failed:', copyErr.message);
          nextPosition++;
          continue;
        }

        payload = { ...payload, file_path: destPath };
      }

      const row: Record<string, unknown> = {
        [idColumn]:              target_entity_id,
        company_id:              auth.companyId,
        position:                nextPosition,
        type:                    src.type,
        title:                   src.title,
        indent:                  src.indent ?? 0,
        enabled:                 true,
        link_url:                src.link_url ?? null,
        link_label:              src.link_label ?? null,
        orientation:             src.orientation ?? 'auto',
        show_title:              src.show_title ?? true,
        show_member_badge:       src.show_member_badge ?? false,
        show_client_logo:        src.show_client_logo ?? false,
        prepared_by_member_id:   src.prepared_by_member_id ?? null,
        payload,
      };

      const { data, error: insertErr } = await supabase
        .from(pagesTable)
        .insert(row)
        .select()
        .single();

      if (insertErr) {
        console.error('[page-library/import] insert failed:', insertErr.message);
        nextPosition++;
        continue;
      }

      inserted.push(rowToUnifiedPage(data as Record<string, unknown>, idColumn));
      nextPosition++;
    }

    if (inserted.length === 0) {
      return NextResponse.json({ error: 'Failed to import any pages' }, { status: 500 });
    }

    return NextResponse.json({ pages: inserted, imported: inserted.length });
  } catch (err) {
    console.error('[page-library/import] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
