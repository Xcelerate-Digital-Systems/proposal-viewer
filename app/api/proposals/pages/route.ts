// app/api/proposals/pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import {
  getPages,
  addPage,
  updatePage,
  deletePage,
  insertPdfPage,
  replacePdfPage,
  PageType,
} from '@/lib/page-operations';

export const dynamic = 'force-dynamic';

/* ─── GET — fetch all pages for a proposal ───────────────────────────────── */
/*
 * Query params: proposal_id | share_token
 */

export async function GET(req: NextRequest) {
  try {
    const supabase   = createServiceClient();
    const proposalId = req.nextUrl.searchParams.get('proposal_id');
    const shareToken = req.nextUrl.searchParams.get('share_token');

    if (!proposalId && !shareToken) {
      return NextResponse.json({ error: 'proposal_id or share_token required' }, { status: 400 });
    }

    let resolvedId = proposalId;

    if (!resolvedId && shareToken) {
      const { data: proposal, error } = await supabase
        .from('proposals')
        .select('id')
        .eq('share_token', shareToken)
        .single();

      if (error || !proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }
      resolvedId = proposal.id;
    }

    const { pages, error } = await getPages(supabase, 'proposal', resolvedId!);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json(pages);
  } catch (err) {
    console.error('Proposal pages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST — add a page ──────────────────────────────────────────────────── */
/*
 * op: 'insert_pdf'
 *   Body: { proposal_id, company_id?, after_position, temp_path }
 *   Inserts a new PDF page (file already uploaded to storage).
 *
 * op: 'replace_pdf'
 *   Body: { proposal_id, page_id, temp_path }
 *   Replaces the file_path on an existing PDF page.
 *
 * op: (absent)  →  non-PDF page add
 *   Body: { proposal_id, company_id?, type, position?, title?, payload?, ...meta }
 *   Proposals support: text, pricing, packages, section, toc
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body     = await req.json();
    const { op }   = body;

    if (op === 'insert_pdf')  return handleInsertPdf(supabase, body);
    if (op === 'replace_pdf') return handleReplacePdf(supabase, body);
    return handleAdd(supabase, body);
  } catch (err) {
    console.error('Proposal pages POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleInsertPdf(
  supabase: ReturnType<typeof createServiceClient>,
  body: Record<string, unknown>,
) {
  const { proposal_id, company_id, after_position, temp_path } = body;

  if (!proposal_id || !temp_path) {
    return NextResponse.json({ error: 'proposal_id and temp_path are required' }, { status: 400 });
  }

  let resolvedCompanyId = company_id as string | undefined;
  if (!resolvedCompanyId) {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('company_id')
      .eq('id', proposal_id)
      .single();
    resolvedCompanyId = proposal?.company_id;
  }

  if (!resolvedCompanyId) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const afterPos = typeof after_position === 'number' ? after_position : -1;

  const { page, totalPages, error } = await insertPdfPage(supabase, 'proposal', {
    entityId:      proposal_id as string,
    companyId:     resolvedCompanyId,
    afterPosition: afterPos,
    tempPath:      temp_path as string,
  });

  if (!page) {
    return NextResponse.json({ error: error ?? 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true, page, totalPages });
}

async function handleReplacePdf(
  supabase: ReturnType<typeof createServiceClient>,
  body: Record<string, unknown>,
) {
  const { page_id, temp_path } = body;

  if (!page_id || !temp_path) {
    return NextResponse.json({ error: 'page_id and temp_path are required' }, { status: 400 });
  }

  const { success, error } = await replacePdfPage(supabase, 'proposal', {
    pageId:   page_id as string,
    tempPath: temp_path as string,
  });

  if (!success) {
    return NextResponse.json({ error: error ?? 'Replace failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleAdd(
  supabase: ReturnType<typeof createServiceClient>,
  body: Record<string, unknown>,
) {
  const { proposal_id, company_id, type, position, title, payload, ...meta } = body;

  if (!proposal_id || !type) {
    return NextResponse.json({ error: 'proposal_id and type are required' }, { status: 400 });
  }

  const validTypes: PageType[] = ['text', 'pricing', 'packages', 'section', 'toc'];
  if (!validTypes.includes(type as PageType)) {
    return NextResponse.json(
      { error: `Invalid type '${type}'. Valid types: ${validTypes.join(', ')}` },
      { status: 400 },
    );
  }

  let resolvedCompanyId = company_id as string | undefined;
  if (!resolvedCompanyId) {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('company_id')
      .eq('id', proposal_id)
      .single();
    resolvedCompanyId = proposal?.company_id;
  }

  if (!resolvedCompanyId) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const { page, error } = await addPage(supabase, 'proposal', {
    entityId:         proposal_id as string,
    companyId:        resolvedCompanyId,
    type:             type as PageType,
    position:         position as number | undefined,
    title:            title as string | undefined,
    payload:          (payload as Record<string, unknown>) ?? {},
    indent:           meta.indent as number | undefined,
    linkUrl:          (meta.link_url as string) ?? null,
    linkLabel:        (meta.link_label as string) ?? null,
    orientation:      meta.orientation as string | undefined,
    showTitle:        meta.show_title as boolean | undefined,
    showMemberBadge:  meta.show_member_badge as boolean | undefined,
  });

  if (!page) {
    return NextResponse.json({ error: error ?? 'Failed to add page' }, { status: 500 });
  }

  return NextResponse.json(page);
}

/* ─── PUT — update a page ────────────────────────────────────────────────── */
/*
 * Query param: ?id=<page_id>
 * Body: any updatable fields + optional payload or payload_patch
 */

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const pageId   = req.nextUrl.searchParams.get('id');

    if (!pageId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await req.json();
    const {
      title, indent, enabled, link_url, link_label,
      orientation, show_title, show_member_badge, show_client_logo, prepared_by_member_id,
      payload, payload_patch,
    } = body;

    const { page, error } = await updatePage(supabase, 'proposal', pageId, {
      ...(title                 !== undefined && { title }),
      ...(indent                !== undefined && { indent }),
      ...(enabled               !== undefined && { enabled }),
      ...(link_url              !== undefined && { link_url }),
      ...(link_label            !== undefined && { link_label }),
      ...(orientation           !== undefined && { orientation }),
      ...(show_title            !== undefined && { show_title }),
      ...(show_member_badge     !== undefined && { show_member_badge }),
      ...(show_client_logo      !== undefined && { show_client_logo }),
      ...(prepared_by_member_id !== undefined && { prepared_by_member_id }),
      ...(payload               !== undefined && { payload }),
      ...(payload_patch         !== undefined && { payload_patch }),
    });

    if (!page) {
      return NextResponse.json({ error: error ?? 'Update failed' }, { status: 500 });
    }

    return NextResponse.json(page);
  } catch (err) {
    console.error('Proposal pages PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── DELETE — delete a page ─────────────────────────────────────────────── */
/*
 * Body: { proposal_id, page_id }
 */

export async function DELETE(req: NextRequest) {
  try {
    const supabase                    = createServiceClient();
    const { proposal_id, page_id }    = await req.json();

    if (!proposal_id || !page_id) {
      return NextResponse.json({ error: 'proposal_id and page_id are required' }, { status: 400 });
    }

    const { success, totalPages, error, status } = await deletePage(supabase, 'proposal', {
      entityId: proposal_id,
      pageId:   page_id,
    });

    if (!success) {
      return NextResponse.json({ error: error ?? 'Delete failed' }, { status: status ?? 500 });
    }

    return NextResponse.json({ success: true, totalPages });
  } catch (err) {
    console.error('Proposal pages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}