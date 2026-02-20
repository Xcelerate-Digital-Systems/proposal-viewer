// app/api/proposals/replace-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const proposalId = formData.get('proposal_id') as string;
    const pageNumber = parseInt(formData.get('page_number') as string); // 1-indexed
    const file = formData.get('file') as File;

    if (!proposalId || !pageNumber || !file) {
      return NextResponse.json({ error: 'Missing proposal_id, page_number, or file' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get proposal to find file_path
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, file_path')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Download existing proposal PDF
    const { data: existingFile, error: downloadError } = await supabase.storage
      .from('proposals')
      .download(proposal.file_path);

    if (downloadError || !existingFile) {
      return NextResponse.json({ error: 'Failed to download existing PDF' }, { status: 500 });
    }

    const existingBytes = await existingFile.arrayBuffer();
    const existingDoc = await PDFDocument.load(existingBytes);
    const totalPages = existingDoc.getPageCount();

    if (pageNumber < 1 || pageNumber > totalPages) {
      return NextResponse.json(
        { error: `Invalid page number. PDF has ${totalPages} pages.` },
        { status: 400 }
      );
    }

    // Extract first page from uploaded PDF
    const uploadedBytes = await file.arrayBuffer();
    const uploadedDoc = await PDFDocument.load(uploadedBytes);
    const [newPage] = await existingDoc.copyPages(uploadedDoc, [0]);

    // Remove old page and insert new one at the same position (0-indexed)
    const pageIndex = pageNumber - 1;
    existingDoc.removePage(pageIndex);
    existingDoc.insertPage(pageIndex, newPage);

    // Save modified PDF
    const modifiedBytes = await existingDoc.save();

    // Re-upload, overwriting original
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(proposal.file_path, modifiedBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload modified PDF' }, { status: 500 });
    }

    // Update file size
    await supabase
      .from('proposals')
      .update({
        file_size_bytes: modifiedBytes.byteLength,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    return NextResponse.json({
      success: true,
      page_number: pageNumber,
      total_pages: totalPages,
      file_size_bytes: modifiedBytes.byteLength,
    });
  } catch (err) {
    console.error('Replace page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}