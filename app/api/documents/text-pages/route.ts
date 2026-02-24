// app/api/documents/text-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — Fetch all text pages for a document (by document_id or share_token)
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const documentId = req.nextUrl.searchParams.get('document_id');
    const shareToken = req.nextUrl.searchParams.get('share_token');

    if (!documentId && !shareToken) {
      return NextResponse.json({ error: 'document_id or share_token required' }, { status: 400 });
    }

    let resolvedDocumentId = documentId;
    if (shareToken && !documentId) {
      const { data: document } = await supabase
        .from('documents')
        .select('id')
        .eq('share_token', shareToken)
        .single();
      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      resolvedDocumentId = document.id;
    }

    const { data, error } = await supabase
      .from('document_text_pages')
      .select('*')
      .eq('document_id', resolvedDocumentId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Document text pages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create or update a document text page
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { document_id, id, ...pageData } = body;

    if (!document_id) {
      return NextResponse.json({ error: 'document_id is required' }, { status: 400 });
    }

    // Get the document's company_id
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('id, company_id')
      .eq('id', document_id)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (id) {
      // Update existing text page
      const { data, error } = await supabase
        .from('document_text_pages')
        .update({
          ...pageData,
          updated_at: now,
        })
        .eq('id', id)
        .eq('document_id', document_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // Get next sort_order
      const { data: existing } = await supabase
        .from('document_text_pages')
        .select('sort_order')
        .eq('document_id', document_id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      // Insert new text page
      const { data, error } = await supabase
        .from('document_text_pages')
        .insert({
          document_id,
          company_id: document.company_id,
          ...pageData,
          sort_order: pageData.sort_order ?? nextSort,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (err) {
    console.error('Document text pages POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove a document text page
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('document_text_pages')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Document text pages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}