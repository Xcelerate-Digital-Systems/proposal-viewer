// app/api/templates/merge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { pages, proposal_file_path } = body;

    if (!pages || !Array.isArray(pages) || pages.length === 0 || !proposal_file_path) {
      return NextResponse.json({ error: 'Missing pages or proposal_file_path' }, { status: 400 });
    }

    // Service-role storage writes need company-scoping or this is an arbitrary
    // file overwrite primitive. Storage paths follow `<entity>/<uuid>/...`;
    // resolve each uuid against its table and verify it belongs to the caller.
    const allPaths: string[] = [proposal_file_path, ...pages.map((p: { file_path: string }) => p.file_path)];
    const supabase = createServiceClient();

    const entityIds: { kind: 'template' | 'proposal' | 'document'; id: string }[] = [];
    for (const p of allPaths) {
      if (typeof p !== 'string' || p.includes('..')) {
        return NextResponse.json({ error: `Invalid path: ${p}` }, { status: 400 });
      }
      const m = p.match(/^(templates|proposals|documents)\/([0-9a-f-]{36})\//i);
      if (!m) {
        return NextResponse.json({ error: `Path not under a recognised entity prefix: ${p}` }, { status: 400 });
      }
      entityIds.push({
        kind: m[1].slice(0, -1) as 'template' | 'proposal' | 'document',
        id: m[2],
      });
    }

    const templateIds = Array.from(new Set(entityIds.filter((e) => e.kind === 'template').map((e) => e.id)));
    const proposalIds = Array.from(new Set(entityIds.filter((e) => e.kind === 'proposal').map((e) => e.id)));
    const documentIds = Array.from(new Set(entityIds.filter((e) => e.kind === 'document').map((e) => e.id)));

    const ownsAll = async (table: string, ids: string[]): Promise<boolean> => {
      if (ids.length === 0) return true;
      const { data } = await supabase.from(table).select('id').in('id', ids).eq('company_id', auth.companyId);
      return (data?.length ?? 0) === ids.length;
    };

    const [okTemplates, okProposals, okDocuments] = await Promise.all([
      ownsAll('proposal_templates', templateIds),
      ownsAll('proposals', proposalIds),
      ownsAll('documents', documentIds),
    ]);

    if (!okTemplates || !okProposals || !okDocuments) {
      return NextResponse.json({ error: 'Path references resource outside your company' }, { status: 403 });
    }

    const mergedDoc = await PDFDocument.create();

    for (const page of pages) {
      const { data: fileData, error } = await supabase.storage
        .from('proposals')
        .download(page.file_path);

      if (error || !fileData) {
        console.error(`Failed to download ${page.file_path}:`, error);
        return NextResponse.json({ error: `Failed to download page: ${page.file_path}` }, { status: 500 });
      }

      const pageBytes = await fileData.arrayBuffer();
      const pageDoc = await PDFDocument.load(pageBytes);
      const copiedPages = await mergedDoc.copyPages(pageDoc, pageDoc.getPageIndices());
      copiedPages.forEach((p) => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save();

    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(proposal_file_path, mergedBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload merged PDF' }, { status: 500 });
    }

    return NextResponse.json({
      file_path: proposal_file_path,
      file_size_bytes: mergedBytes.byteLength,
      page_count: mergedDoc.getPageCount(),
    });
  } catch (err) {
    console.error('Merge error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
