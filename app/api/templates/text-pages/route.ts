// app/api/templates/text-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — Fetch all text pages for a template
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const templateId = req.nextUrl.searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('template_text_pages')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Template text pages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create or update a template text page
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { template_id, id, ...pageData } = body;

    if (!template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }

    // Get the template's company_id
    const { data: template, error: templateError } = await supabase
      .from('proposal_templates')
      .select('id, company_id')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (id) {
      // Update existing text page
      const { data, error } = await supabase
        .from('template_text_pages')
        .update({
          ...pageData,
          updated_at: now,
        })
        .eq('id', id)
        .eq('template_id', template_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // Get next sort_order
      const { data: existing } = await supabase
        .from('template_text_pages')
        .select('sort_order')
        .eq('template_id', template_id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      // Insert new text page
      const { data, error } = await supabase
        .from('template_text_pages')
        .insert({
          template_id,
          company_id: template.company_id,
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
    console.error('Template text pages POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove a template text page
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('template_text_pages')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Template text pages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}