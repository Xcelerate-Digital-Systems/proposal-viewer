// app/api/proposals/delete-page/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { proposal_id, page_number } = await req.json();

    if (!proposal_id || !page_number) {
      return NextResponse.json(
        { error: 'Missing proposal_id or page_number' },
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

    if (page_number < 1 || page_number > totalPages) {
      return NextResponse.json(
        { error: `Invalid page number. PDF has ${totalPages} pages.` },
        { status: 400 }
      );
    }

    if (totalPages <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the only remaining page.' },
        { status: 400 }
      );
    }

    // Remove the page (0-indexed)
    existingDoc.removePage(page_number - 1);

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

    // Update page_names array: remove the entry at the deleted position
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

    // Remove the entry
    currentNames.splice(page_number - 1, 1);

    const newTotalPages = existingDoc.getPageCount();

    // Update proposal record
    await supabase
      .from('proposals')
      .update({
        file_size_bytes: modifiedBytes.byteLength,
        page_names: currentNames,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposal_id);

    return NextResponse.json({
      success: true,
      deleted_page: page_number,
      total_pages: newTotalPages,
      file_size_bytes: modifiedBytes.byteLength,
    });
  } catch (err) {
    console.error('Delete page error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}