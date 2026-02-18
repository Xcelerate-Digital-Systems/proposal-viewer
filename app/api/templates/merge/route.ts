// app/api/templates/merge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { pages, proposal_file_path } = await req.json();

    // pages: array of { file_path: string } in order
    if (!pages || !Array.isArray(pages) || pages.length === 0 || !proposal_file_path) {
      return NextResponse.json({ error: 'Missing pages or proposal_file_path' }, { status: 400 });
    }

    const supabase = createServiceClient();
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

    // Upload merged PDF
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