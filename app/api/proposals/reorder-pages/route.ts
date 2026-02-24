// app/api/proposals/reorder-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { proposal_id, page_order, table_name } = await req.json();
    const tableName = table_name === 'documents' ? 'documents' : 'proposals';

    if (!proposal_id || !Array.isArray(page_order)) {
      return NextResponse.json(
        { error: 'Missing proposal_id or page_order' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get record to find file_path
    const { data: proposal, error: proposalError } = await supabase
      .from(tableName)
      .select('id, file_path')
      .eq('id', proposal_id)
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

    // Validate page_order: must contain exactly the right indices
    if (page_order.length !== totalPages) {
      return NextResponse.json(
        { error: `page_order length (${page_order.length}) must match PDF page count (${totalPages})` },
        { status: 400 }
      );
    }

    const sorted = [...page_order].sort((a, b) => a - b);
    const expected = Array.from({ length: totalPages }, (_, i) => i);
    if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
      return NextResponse.json(
        { error: 'page_order must contain each page index exactly once (0-based)' },
        { status: 400 }
      );
    }

    // Check if order actually changed
    const isIdentity = page_order.every((v: number, i: number) => v === i);
    if (isIdentity) {
      return NextResponse.json({
        success: true,
        reordered: false,
        total_pages: totalPages,
      });
    }

    // Create new PDF with pages in new order
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(existingDoc, page_order);
    copiedPages.forEach((page) => {
      newDoc.addPage(page);
    });

    // Save modified PDF
    const modifiedBytes = await newDoc.save();

    // Re-upload, overwriting original
    const { error: uploadError } = await supabase.storage
      .from('proposals')
      .upload(proposal.file_path, modifiedBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Failed to upload reordered PDF' }, { status: 500 });
    }

    // NOTE: page_names reordering is handled by the client via flushPendingSaves()
    // before calling this API. The client's handleDragEnd rebuilds the entries array
    // with groups in correct positions and saves it. We only update file metadata here.
    await supabase
      .from(tableName)
      .update({
        file_size_bytes: modifiedBytes.byteLength,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposal_id);

    return NextResponse.json({
      success: true,
      reordered: true,
      total_pages: totalPages,
      file_size_bytes: modifiedBytes.byteLength,
    });
  } catch (err) {
    console.error('Reorder pages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}