// app/api/company/branding/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// GET - Public endpoint to fetch company branding for proposal viewer
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, slug, logo_path, accent_color, website, bg_primary, bg_secondary, sidebar_text_color, accept_text_color')
      .eq('id', companyId)
      .single();

    if (error || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let logo_url = null;
    if (company.logo_path) {
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(company.logo_path);
      logo_url = urlData?.publicUrl || null;
    }

    return NextResponse.json({
      name: company.name,
      logo_url,
      accent_color: company.accent_color || '#ff6700',
      website: company.website,
      bg_primary: company.bg_primary || '#0f0f0f',
      bg_secondary: company.bg_secondary || '#141414',
      sidebar_text_color: company.sidebar_text_color || '#ffffff',
      accept_text_color: company.accept_text_color || '#ffffff',
    });
  } catch (err) {
    console.error('Branding fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}