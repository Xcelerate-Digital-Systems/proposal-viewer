// app/api/templates/section-headers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — Fetch section headers for a template
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const templateId = req.nextUrl.searchParams.get('template_id');

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('proposal_templates')
      .select('section_headers')
      .eq('id', templateId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data?.section_headers || []);
  } catch (err) {
    console.error('Section headers GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Save section headers for a template
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { template_id, section_headers } = body;

    if (!template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }

    if (!Array.isArray(section_headers)) {
      return NextResponse.json({ error: 'section_headers must be an array' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('proposal_templates')
      .update({ section_headers })
      .eq('id', template_id)
      .select('section_headers')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data?.section_headers || []);
  } catch (err) {
    console.error('Section headers POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}