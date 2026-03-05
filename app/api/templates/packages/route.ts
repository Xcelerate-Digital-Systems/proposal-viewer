// app/api/templates/packages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — Fetch all packages pages for a template (returns array)
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const templateId = req.nextUrl.searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('template_packages')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Template packages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create a new packages page for a template
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { template_id, company_id, ...packagesData } = body;

    if (!template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }

    // Resolve company_id if not provided
    let resolvedCompanyId = company_id;
    if (!resolvedCompanyId) {
      const { data: template, error: templateError } = await supabase
        .from('proposal_templates')
        .select('id, company_id')
        .eq('id', template_id)
        .single();

      if (templateError || !template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      resolvedCompanyId = template.company_id;
    }

    // Determine sort_order from existing count
    const { count } = await supabase
      .from('template_packages')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', template_id);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('template_packages')
      .insert({
        template_id,
        company_id: resolvedCompanyId,
        sort_order: count ?? 0,
        ...packagesData,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Template packages POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT — Update a packages page by id
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await req.json();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('template_packages')
      .update({ ...body, updated_at: now })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Template packages PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Delete a packages page by id
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('template_packages')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Template packages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}