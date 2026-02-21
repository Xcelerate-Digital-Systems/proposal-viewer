// app/api/templates/reorder-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { template_id, page_order } = await req.json();

    if (!template_id || !Array.isArray(page_order)) {
      return NextResponse.json(
        { error: 'Missing template_id or page_order' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get all template pages ordered by current page_number
    const { data: pages, error: pagesError } = await supabase
      .from('template_pages')
      .select('id, page_number, file_path, label, indent')
      .eq('template_id', template_id)
      .order('page_number', { ascending: true });

    if (pagesError || !pages) {
      return NextResponse.json({ error: 'Failed to fetch template pages' }, { status: 500 });
    }

    const totalPages = pages.length;

    // Validate page_order: must contain exactly the right indices (0-based)
    if (page_order.length !== totalPages) {
      return NextResponse.json(
        { error: `page_order length (${page_order.length}) must match page count (${totalPages})` },
        { status: 400 }
      );
    }

    const sorted = [...page_order].sort((a: number, b: number) => a - b);
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
      return NextResponse.json({ success: true, reordered: false, total_pages: totalPages });
    }

    // Reorder: update page_number for each page
    // Use a two-pass approach to avoid unique constraint conflicts:
    // 1. Set all page_numbers to negative (temporary)
    // 2. Set them to the correct new values
    for (let i = 0; i < totalPages; i++) {
      const origIdx = page_order[i];
      const page = pages[origIdx];
      await supabase
        .from('template_pages')
        .update({ page_number: -(i + 1) })
        .eq('id', page.id);
    }

    for (let i = 0; i < totalPages; i++) {
      const origIdx = page_order[i];
      const page = pages[origIdx];
      await supabase
        .from('template_pages')
        .update({ page_number: i + 1 })
        .eq('id', page.id);
    }

    // Update template updated_at
    await supabase
      .from('proposal_templates')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', template_id);

    return NextResponse.json({
      success: true,
      reordered: true,
      total_pages: totalPages,
    });
  } catch (err) {
    console.error('Template reorder pages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}