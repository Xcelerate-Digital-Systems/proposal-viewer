// app/api/company/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

async function getAuthenticatedMember(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return member;
}

/**
 * Resolve the effective company_id, respecting super admin overrides.
 * If a company_id query param is provided and the user is a super admin,
 * use that instead of their own company_id.
 */
function resolveCompanyId(req: NextRequest, member: { company_id: string; is_super_admin?: boolean }): string {
  const overrideId = req.nextUrl.searchParams.get('company_id');
  if (overrideId && member.is_super_admin) {
    return overrideId;
  }
  return member.company_id;
}

// GET - Get company details
export async function GET(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = resolveCompanyId(req, member);
    const supabase = createServiceClient();

    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
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

    // If super admin is viewing another company, treat as owner for UI purposes
    const effectiveRole = (member.is_super_admin && companyId !== member.company_id)
      ? 'owner'
      : member.role;

    return NextResponse.json({
      ...company,
      logo_url,
      current_role: effectiveRole,
    });
  } catch (err) {
    console.error('Get company error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update company settings
export async function PATCH(req: NextRequest) {
  try {
    const member = await getAuthenticatedMember(req);
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = resolveCompanyId(req, member);

    // Allow if owner of the company OR super admin
    const isSuperAdminOverride = member.is_super_admin && companyId !== member.company_id;
    if (member.role !== 'owner' && !isSuperAdminOverride) {
      return NextResponse.json({ error: 'Only owners can update company settings' }, { status: 403 });
    }

    const body = await req.json();
    const allowedFields = ['name', 'slug', 'accent_color', 'website', 'logo_path', 'bg_primary', 'bg_secondary', 'sidebar_text_color', 'accept_text_color'];
    const updates: Record<string, unknown> = {};

    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate slug format
    if (updates.slug) {
      const slug = String(updates.slug).toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (slug.length < 2) {
        return NextResponse.json({ error: 'Slug must be at least 2 characters' }, { status: 400 });
      }
      updates.slug = slug;

      const supabase = createServiceClient();
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .neq('id', companyId)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'This slug is already taken' }, { status: 400 });
      }
    }

    // Validate color fields
    const colorFields = ['accent_color', 'bg_primary', 'bg_secondary', 'sidebar_text_color', 'accept_text_color'];
    for (const field of colorFields) {
      if (updates[field]) {
        const color = String(updates[field]);
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
          return NextResponse.json({ error: `Invalid color format for ${field}. Use #RRGGBB` }, { status: 400 });
        }
      }
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let logo_url = null;
    if (data.logo_path) {
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(data.logo_path);
      logo_url = urlData?.publicUrl || null;
    }

    return NextResponse.json({ ...data, logo_url });
  } catch (err) {
    console.error('Update company error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}