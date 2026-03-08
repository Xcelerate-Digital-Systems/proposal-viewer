// app/api/templates/pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';
import {
  getPages,
  addPage,
  updatePage,
  deletePage,
  insertPdfPage,
  replacePdfPage,
} from '@/lib/page-operations';
import { rebuildTemplateMerged } from '@/lib/rebuild-template-merged';

export const dynamic = 'force-dynamic';

/* ─── GET — fetch all pages for a template ───────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const templateId = req.nextUrl.searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const { pages, error } = await getPages(supabase, 'template', templateId);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json(pages);
  } catch (err) {
    console.error('Template pages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST — add a page ──────────────────────────────────────────────────── */
/*
 * Two modes detected by Content-Type:
 *
 * 1. multipart/form-data  →  PDF upload (insert or replace)
 *    Fields: template_id, company_id, after_position (int), file (File), mode? ('insert'|'replace'|'auto')
 *
 * 2. application/json  →  Non-PDF page (text, pricing, packages, section, toc)
 *    Body: { template_id, company_id, type, position?, title?, payload?, ...meta }
 */

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    return handlePdfUpload(req);
  }

  return handleJsonAdd(req);
}

async function handlePdfUpload(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const formData = await req.formData();

    const templateId   = formData.get('template_id') as string;
    const companyId    = formData.get('company_id') as string;
    const afterPos     = parseInt(formData.get('after_position') as string, 10);
    const file         = formData.get('file') as File;
    const mode         = (formData.get('mode') as string) || 'auto';
    // For replace mode: the id of the page to replace
    const replacePageId = formData.get('page_id') as string | null;

    if (!templateId || !companyId || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extract first page from uploaded PDF
    const pdfBytes     = await file.arrayBuffer();
    const pdfDoc       = await PDFDocument.load(pdfBytes);
    const singlePage   = await PDFDocument.create();
    const [copiedPage] = await singlePage.copyPages(pdfDoc, [0]);
    singlePage.addPage(copiedPage);
    const singlePageBytes = await singlePage.save();

    // Sanitise filename — no special chars in storage paths
    const safeName = `page-${Date.now()}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = `templates/${templateId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(tempPath, singlePageBytes, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload page' }, { status: 500 });
    }

    if (mode === 'replace' && replacePageId) {
      // Replace an existing PDF page's file
      const { success, error } = await replacePdfPage(supabase, 'template', {
        pageId:   replacePageId,
        tempPath,
      });

      if (!success) {
        return NextResponse.json({ error: error ?? 'Replace failed' }, { status: 500 });
      }
    } else {
      // Insert new PDF page after afterPos
      const { page, error } = await insertPdfPage(supabase, 'template', {
        entityId:      templateId,
        companyId,
        afterPosition: isNaN(afterPos) ? -1 : afterPos,
        tempPath,
      });

      if (!page) {
        return NextResponse.json({ error: error ?? 'Insert failed' }, { status: 500 });
      }
    }

    // Rebuild merged PDF so template preview stays in sync
    try {
      await rebuildTemplateMerged(templateId);
    } catch (err) {
      console.error('Non-fatal: failed to rebuild merged PDF after page add:', err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Template pages PDF upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleJsonAdd(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { template_id, company_id, type, position, title, payload, ...meta } = body;

    if (!template_id || !type) {
      return NextResponse.json({ error: 'template_id and type are required' }, { status: 400 });
    }

    // Resolve company_id if not provided
    let resolvedCompanyId = company_id;
    if (!resolvedCompanyId) {
      const { data: template, error: tmplError } = await supabase
        .from('proposal_templates')
        .select('company_id')
        .eq('id', template_id)
        .single();

      if (tmplError || !template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      resolvedCompanyId = template.company_id;
    }

    const { page, error } = await addPage(supabase, 'template', {
      entityId:         template_id,
      companyId:        resolvedCompanyId,
      type,
      position,
      title,
      payload:          payload ?? {},
      indent:           meta.indent,
      linkUrl:          meta.link_url ?? null,
      linkLabel:        meta.link_label ?? null,
      orientation:      meta.orientation,
      showTitle:        meta.show_title,
      showMemberBadge:  meta.show_member_badge,
    });

    if (!page) {
      return NextResponse.json({ error: error ?? 'Failed to add page' }, { status: 500 });
    }

    return NextResponse.json(page);
  } catch (err) {
    console.error('Template pages JSON add error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── PUT — update a page ────────────────────────────────────────────────── */
/*
 * Query param: ?id=<page_id>
 * Body: any combination of top-level fields + optional payload or payload_patch
 */

export async function PUT(req: NextRequest) {
  try {
    const supabase  = createServiceClient();
    const pageId    = req.nextUrl.searchParams.get('id');

    if (!pageId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await req.json();
    const {
      title, indent, enabled, link_url, link_label,
      orientation, show_title, show_member_badge, show_client_logo, prepared_by_member_id,
      payload, payload_patch,
    } = body;

    const { page, error } = await updatePage(supabase, 'template', pageId, {
      ...(title                !== undefined && { title }),
      ...(indent               !== undefined && { indent }),
      ...(enabled              !== undefined && { enabled }),
      ...(link_url             !== undefined && { link_url }),
      ...(link_label           !== undefined && { link_label }),
      ...(orientation          !== undefined && { orientation }),
      ...(show_title           !== undefined && { show_title }),
      ...(show_member_badge    !== undefined && { show_member_badge }),
      ...(show_client_logo     !== undefined && { show_client_logo }),
      ...(prepared_by_member_id !== undefined && { prepared_by_member_id }),
      ...(payload              !== undefined && { payload }),
      ...(payload_patch        !== undefined && { payload_patch }),
    });

    if (!page) {
      return NextResponse.json({ error: error ?? 'Update failed' }, { status: 500 });
    }

    return NextResponse.json(page);
  } catch (err) {
    console.error('Template pages PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── DELETE — delete a page ─────────────────────────────────────────────── */
/*
 * Body: { template_id, page_id }
 * Rebuilds merged PDF after deletion so template preview stays in sync.
 */

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { template_id, page_id } = await req.json();

    if (!template_id || !page_id) {
      return NextResponse.json({ error: 'template_id and page_id are required' }, { status: 400 });
    }

    const { success, totalPages, error, status } = await deletePage(supabase, 'template', {
      entityId: template_id,
      pageId:   page_id,
    });

    if (!success) {
      return NextResponse.json({ error: error ?? 'Delete failed' }, { status: status ?? 500 });
    }

    // Rebuild merged PDF so template preview stays in sync
    try {
      await rebuildTemplateMerged(template_id);
    } catch (err) {
      console.error('Non-fatal: failed to rebuild merged PDF after page delete:', err);
    }

    return NextResponse.json({ success: true, totalPages });
  } catch (err) {
    console.error('Template pages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}