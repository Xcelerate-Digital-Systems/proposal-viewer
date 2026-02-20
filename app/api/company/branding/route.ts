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
      .select('id, name, slug, logo_path, accent_color, website, bg_primary, bg_secondary, sidebar_text_color, accept_text_color, cover_bg_style, cover_bg_color_1, cover_bg_color_2, cover_text_color, cover_subtitle_color, cover_button_bg, cover_button_text, cover_overlay_opacity, cover_gradient_type, cover_gradient_angle')
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
      // Cover page branding
      cover_bg_style: company.cover_bg_style || 'gradient',
      cover_bg_color_1: company.cover_bg_color_1 || '#0f0f0f',
      cover_bg_color_2: company.cover_bg_color_2 || '#141414',
      cover_text_color: company.cover_text_color || '#ffffff',
      cover_subtitle_color: company.cover_subtitle_color || '#ffffffb3',
      cover_button_bg: company.cover_button_bg || '#ff6700',
      cover_button_text: company.cover_button_text || '#ffffff',
      cover_overlay_opacity: parseFloat(company.cover_overlay_opacity) || 0.65,
      cover_gradient_type: company.cover_gradient_type || 'linear',
      cover_gradient_angle: parseInt(company.cover_gradient_angle) || 135,
    });
  } catch (err) {
    console.error('Branding fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}