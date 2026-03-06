// app/api/proposals/insert-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';
import { normalizePageNamesWithGroups, pdfIndexToEntryIndex } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposal_id: proposalId, table_name: tableNameRaw, after_page, temp_path } = body;
    const tableName = tableNameRaw === 'documents' ? 'documents' : 'proposals';
    const afterPage = parseInt(after_page);

    if (!proposalId || isNaN(afterPage) || !temp_path) {
      return NextResponse.json(
        { error: 'Missing proposal_id, after_page, or temp_path' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get record to find file_path and current page_names
    const { data: proposal, error: proposalError } = await supabase
      .from(tableName)
      .select('id, file_path, page_names')
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

    // Download the new page from temp storage
    const { data: tempFile, error: tempError } = await supabase.storage
      .from('proposals')
      .download(temp_path);

    if (tempError || !tempFile) {
      return NextResponse.json({ error: 'Failed to download new page from temp storage' }, { status: 500 });
    }

    const existingBytes = await existingFile.arrayBuffer();
    const existingDoc = await PDFDocument.load(existingBytes);
    const totalPages = existingDoc.getPageCount();

    if (afterPage < 0 || afterPage > totalPages) {
      return NextResponse.json(
        { error: `Invalid position. PDF has ${totalPages} pages.` },
        { status: 400 }
      );
    }

    // Load uploaded PDF and copy all its pages (supports multi-page inserts)
    const uploadedBytes = await tempFile.arrayBuffer();
    const uploadedDoc = await PDFDocument.load(uploadedBytes);
    const uploadedPageCount = uploadedDoc.getPageCount();

    const pageIndices = Array.from({ length: uploadedPageCount }, (_, i) => i);
    const copiedPages = await existingDoc.copyPages(uploadedDoc, pageIndices);

    // Insert pages at the correct position
    const insertIndex = afterPage;
    copiedPages.forEach((page, i) => {
      existingDoc.insertPage(insertIndex + i, page);
    });

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

    // Update page_names array preserving group entries
    const currentNames = normalizePageNamesWithGroups(proposal.page_names, totalPages);

    let entryInsertIdx: number;
    if (afterPage === 0) {
      entryInsertIdx = 0;
    } else {
      const prevEntryIdx = pdfIndexToEntryIndex(currentNames, afterPage - 1);
      entryInsertIdx = prevEntryIdx >= 0 ? prevEntryIdx + 1 : currentNames.length;
    }

    const newEntries = Array.from({ length: uploadedPageCount }, (_, i) => ({
      name: `Page ${afterPage + i + 1}`,
      indent: 0,
    }));
    currentNames.splice(entryInsertIdx, 0, ...newEntries);

    const newTotalPages = existingDoc.getPageCount();

    await supabase
      .from(tableName)
      .update({
        file_size_bytes: modifiedBytes.byteLength,
        page_names: currentNames,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    // Clean up temp file (fire-and-forget)
    supabase.storage.from('proposals').remove([temp_path]).catch(() => {});

    return NextResponse.json({
      success: true,
      inserted_after: afterPage,
      pages_inserted: uploadedPageCount,
      total_pages: newTotalPages,
      file_size_bytes: modifiedBytes.byteLength,
    });
  } catch (err) {
    console.error('Insert page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}