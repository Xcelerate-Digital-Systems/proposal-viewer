// app/api/proposals/pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
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

// Verify the proposal belongs to the authenticated caller's company.
async function ownsProposal(req: NextRequest, proposalId: string) {
  const auth = await getAuthContext(req);
  if (!auth) return null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('proposals')
    .select('company_id')
    .eq('id', proposalId)
    .eq('company_id', auth.companyId)
    .maybeSingle();
  return data ? { auth, companyId: data.company_id as string } : null;
}

// For PUT that operates on a page id, resolve the page → proposal, then verify
// proposal ownership.
async function ownsPage(req: NextRequest, pageId: string) {
  const auth = await getAuthContext(req);
  if (!auth) return null;
  const supabase = createServiceClient();
  const { data: page } = await supabase
    .from('proposal_pages_v2')
    .select('proposal_id')
    .eq('id', pageId)
    .maybeSingle();
  if (!page?.proposal_id) return null;
  const { data: proposal } = await supabase
    .from('proposals')
    .select('company_id')
    .eq('id', page.proposal_id)
    .eq('company_id', auth.companyId)
    .maybeSingle();
  return proposal
    ? { auth, proposalId: page.proposal_id as string, companyId: proposal.company_id as string }
    : null;
}

/* ─── GET — fetch all pages for a proposal ───────────────────────────────── */
/*
 * Query param: proposal_id (required, ownership-checked)
 */

export async function GET(req: NextRequest) {
  try {
    const supabase   = createServiceClient();
    const proposalId = req.nextUrl.searchParams.get('proposal_id');

    if (!proposalId) {
      return NextResponse.json({ error: 'proposal_id required' }, { status: 400 });
    }

    const ownership = await ownsProposal(req, proposalId);
    if (!ownership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pages, error } = await getPages(supabase, 'proposal', proposalId);

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
 *   Body: { proposal_id, after_position, temp_path }
 *   Inserts a new PDF page (file already uploaded to storage).
 *
 * op: 'replace_pdf'
 *   Body: { proposal_id, page_id, temp_path }
 *   Replaces the file_path on an existing PDF page.
 *
 * op: (absent)  →  non-PDF page add
 *   Body: { proposal_id, type, position?, title?, payload?, ...meta }
 *   Proposals support: text, pricing, packages, section, toc
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body     = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const proposalId = body.proposal_id as string | undefined;
    if (!proposalId) {
      return NextResponse.json({ error: 'proposal_id is required' }, { status: 400 });
    }
    const ownership = await ownsProposal(req, proposalId);
    if (!ownership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Force company_id to the verified value so handlers can't be tricked.
    body.company_id = ownership.companyId;

    const { op } = body;
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

  const afterPos = typeof after_position === 'number' ? after_position : -1;

  const { page, totalPages, error } = await insertPdfPage(supabase, 'proposal', {
    entityId:      proposal_id as string,
    companyId:     company_id as string,
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

  const { page, error } = await addPage(supabase, 'proposal', {
    entityId:         proposal_id as string,
    companyId:        company_id as string,
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

    const ownership = await ownsPage(req, pageId);
    if (!ownership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
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
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { proposal_id, page_id }    = body;

    if (!proposal_id || !page_id) {
      return NextResponse.json({ error: 'proposal_id and page_id are required' }, { status: 400 });
    }

    const ownership = await ownsProposal(req, proposal_id);
    if (!ownership) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
