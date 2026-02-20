// app/api/proposals/reorder-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { proposal_id, page_order } = await req.json();

    if (!proposal_id || !Array.isArray(page_order)) {
      return NextResponse.json(
        { error: 'Missing proposal_id or page_order' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get proposal to find file_path and current page_names
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, file_path, page_names')
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

    // Reorder page_names array to match
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

    // Reorder page_names to match new PDF order
    const reorderedNames = page_order.map((oldIndex: number) => currentNames[oldIndex]);

    // Update proposal record
    await supabase
      .from('proposals')
      .update({
        file_size_bytes: modifiedBytes.byteLength,
        page_names: reorderedNames,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposal_id);

    return NextResponse.json({
      success: true,
      reordered: true,
      total_pages: totalPages,
      page_names: reorderedNames,
      file_size_bytes: modifiedBytes.byteLength,
    });
  } catch (err) {
    console.error('Reorder pages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}