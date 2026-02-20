// app/api/proposals/insert-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const proposalId = formData.get('proposal_id') as string;
    const afterPage = parseInt(formData.get('after_page') as string); // 1-indexed, 0 = insert at start
    const file = formData.get('file') as File;

    if (!proposalId || isNaN(afterPage) || !file) {
      return NextResponse.json(
        { error: 'Missing proposal_id, after_page, or file' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get proposal to find file_path and current page_names
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
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

    const existingBytes = await existingFile.arrayBuffer();
    const existingDoc = await PDFDocument.load(existingBytes);
    const totalPages = existingDoc.getPageCount();

    if (afterPage < 0 || afterPage > totalPages) {
      return NextResponse.json(
        { error: `Invalid position. PDF has ${totalPages} pages.` },
        { status: 400 }
      );
    }

    // Load uploaded PDF and copy its first page
    const uploadedBytes = await file.arrayBuffer();
    const uploadedDoc = await PDFDocument.load(uploadedBytes);
    const uploadedPageCount = uploadedDoc.getPageCount();

    // Copy all pages from uploaded PDF (supports multi-page inserts)
    const pageIndices = Array.from({ length: uploadedPageCount }, (_, i) => i);
    const copiedPages = await existingDoc.copyPages(uploadedDoc, pageIndices);

    // Insert pages at the correct position (afterPage is 1-indexed, so insertIndex = afterPage)
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

    // Update page_names array: insert default entries for the new pages
    const currentNames: Array<{ name: string; indent: number }> = Array.isArray(proposal.page_names)
      ? proposal.page_names.map((entry: unknown) => {
          if (typeof entry === 'string') return { name: entry, indent: 0 };
          const obj = entry as { name?: string; indent?: number };
          return { name: obj.name || '', indent: obj.indent || 0 };
        })
      : [];

    // Pad if needed
    while (currentNames.length < totalPages) {
      currentNames.push({ name: `Page ${currentNames.length + 1}`, indent: 0 });
    }

    // Insert new entries at the correct position
    const newEntries = Array.from({ length: uploadedPageCount }, (_, i) => ({
      name: `Page ${insertIndex + i + 1}`,
      indent: 0,
    }));
    currentNames.splice(insertIndex, 0, ...newEntries);

    const newTotalPages = existingDoc.getPageCount();

    // Update proposal record
    await supabase
      .from('proposals')
      .update({
        file_size_bytes: modifiedBytes.byteLength,
        page_names: currentNames,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

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