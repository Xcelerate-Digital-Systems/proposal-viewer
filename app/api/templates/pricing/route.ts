// app/api/templates/pricing/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — Fetch pricing for a template
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const templateId = req.nextUrl.searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('template_pricing')
      .select('*')
      .eq('template_id', templateId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
  } catch (err) {
    console.error('Template pricing GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create or update pricing for a template
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { template_id, ...pricingData } = body;

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

    // Check if pricing row already exists
    const { data: existing } = await supabase
      .from('template_pricing')
      .select('id')
      .eq('template_id', template_id)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('template_pricing')
        .update({
          ...pricingData,
          updated_at: now,
        })
        .eq('template_id', template_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('template_pricing')
        .insert({
          template_id,
          company_id: template.company_id,
          ...pricingData,
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
    console.error('Template pricing POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}