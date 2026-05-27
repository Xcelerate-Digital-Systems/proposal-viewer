// app/api/company/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { getStripe } from '@/lib/billing/stripe';
import { getSubscriptionForCompany } from '@/lib/billing/plan';
import { rateLimit, ipFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

// GET - Get company details
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;
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

    let bg_image_url = null;
    if (company.bg_image_path) {
      const { data: bgUrlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(company.bg_image_path);
      bg_image_url = bgUrlData?.publicUrl || null;
    }

    let cover_image_url = null;
    if (company.cover_image_path) {
      const { data: coverUrlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(company.cover_image_path);
      cover_image_url = coverUrlData?.publicUrl || null;
    }

    // Super admins always have owner-level access in the UI. Agency owners
    // viewing one of their client companies via override also get 'owner'
    // (the override is only granted by getAuthContext when the relationship
    // checks out).
    const overridingAnotherCompany = companyId !== member.company_id;
    const effectiveRole =
      member.is_super_admin ||
      (overridingAnotherCompany && member.role === 'owner')
        ? 'owner'
        : member.role;

    return NextResponse.json({
      ...company,
      logo_url,
      bg_image_url,
      cover_image_url,
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
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { member, companyId } = auth;

    // Super admins can edit any company. Otherwise owner-only — getAuthContext
    // already enforced that the caller is allowed to act on `companyId`.
    if (!member.is_super_admin && member.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can update company settings' }, { status: 403 });
    }

    const body = await req.json();
    const allowedFields = [
      'name', 'slug', 
      'accent_color', 
      'website', 
      'logo_path',
      'bg_primary', 
      'bg_secondary', 
      'sidebar_text_color', 
      'accept_text_color',
      'cover_bg_style', 
      'cover_bg_color_1', 
      'cover_bg_color_2',
      'cover_text_color', 
      'cover_subtitle_color',
      'cover_button_bg', 
      'cover_button_text', 
      'cover_overlay_opacity',
      'cover_gradient_type', 
      'cover_gradient_angle',
      'font_heading', 
      'font_body', 
      'font_sidebar',
      'font_heading_weight', 
      'font_body_weight', 
      'font_sidebar_weight',
      'text_page_bg_color', 
      'text_page_text_color', 
      'text_page_heading_color', 
      'text_page_font_size',
      'text_page_border_enabled',
      'text_page_border_color',
      'text_page_border_radius',
      'text_page_layout',
      'bg_image_path',
      'bg_image_overlay_opacity',
      'cover_image_path',
      'show_job_fields',
      'brand_colors',
      // Quote-side business details + numbering format
      'phone',
      'contact_email',
      'abn',
      'address',
      'quote_number_prefix',
      'quote_number_pad_width',
    ];
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

    // Validate color fields (all #RRGGBB format)
    const colorFields = [
      'accent_color', 
      'bg_primary', 
      'bg_secondary', 
      'sidebar_text_color', 
      'accept_text_color',
      'cover_bg_color_1', 
      'cover_bg_color_2', 
      'cover_text_color', 
      'cover_subtitle_color',
      'cover_button_bg', 
      'cover_button_text', 
      'text_page_bg_color', 
      'text_page_text_color', 
      'text_page_heading_color',
      'text_page_border_color',
    ];
    for (const field of colorFields) {
      if (updates[field]) {
        const color = String(updates[field]);
        if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) {
          return NextResponse.json({ error: `Invalid color format for ${field}. Use #RRGGBB or #RRGGBBAA` }, { status: 400 });
        }
      }
    }

    // Validate cover_bg_style
    if (updates.cover_bg_style) {
      if (!['gradient', 'solid'].includes(String(updates.cover_bg_style))) {
        return NextResponse.json({ error: 'cover_bg_style must be "gradient" or "solid"' }, { status: 400 });
      }
    }

    // Validate cover_overlay_opacity
    if (updates.cover_overlay_opacity !== undefined) {
      const opacity = Number(updates.cover_overlay_opacity);
      if (isNaN(opacity) || opacity < 0 || opacity > 1) {
        return NextResponse.json({ error: 'cover_overlay_opacity must be between 0 and 1' }, { status: 400 });
      }
      updates.cover_overlay_opacity = opacity;
    }

    // Validate cover_gradient_type
    if (updates.cover_gradient_type) {
      if (!['linear', 'radial', 'conic'].includes(String(updates.cover_gradient_type))) {
        return NextResponse.json({ error: 'cover_gradient_type must be "linear", "radial", or "conic"' }, { status: 400 });
      }
    }

    // Validate cover_gradient_angle
    if (updates.cover_gradient_angle !== undefined) {
      const angle = Number(updates.cover_gradient_angle);
      if (isNaN(angle) || angle < 0 || angle > 360) {
        return NextResponse.json({ error: 'cover_gradient_angle must be between 0 and 360' }, { status: 400 });
      }
      updates.cover_gradient_angle = angle;
    }
    
    // Validate text_page_layout
    if (updates.text_page_layout) {
      if (!['contained', 'full'].includes(String(updates.text_page_layout))) {
        return NextResponse.json({ error: 'text_page_layout must be "contained" or "full"' }, { status: 400 });
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
      console.error('[api/company] PATCH:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    let logo_url = null;
    if (data.logo_path) {
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(data.logo_path);
      logo_url = urlData?.publicUrl || null;
    }

    let bg_image_url = null;
    if (data.bg_image_path) {
      const { data: bgUrlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(data.bg_image_path);
      bg_image_url = bgUrlData?.publicUrl || null;
    }

    let cover_image_url = null;
    if (data.cover_image_path) {
      const { data: coverUrlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(data.cover_image_path);
      cover_image_url = coverUrlData?.publicUrl || null;
    }

    return NextResponse.json({ ...data, logo_url, bg_image_url, cover_image_url });
  } catch (err) {
    console.error('Update company error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Soft-delete the workspace.
//
// Owner-only. Requires `confirm_phrase: "DELETE <company_name>"` in the
// body so an accidental click can't nuke an agency. Cancels the active
// Stripe subscription immediately (don't wait for period end — they asked
// to leave) then sets companies.deleted_at. AuthGuard refuses entry from
// that point and useAuth filters this membership out of the workspace
// switcher on next sign-in. The row is kept around for ~30 days for
// accidental-recovery + Stripe reconciliation; a separate purge job (not
// in this commit) hard-deletes after that.
const DELETE_LIMIT = 3;
const DELETE_WINDOW_SECONDS = 300;

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Owner only — admins can't delete the whole workspace they're in.
    // Super admins can delete via /api/admin/* surfaces, not here.
    if (auth.member.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the workspace owner can delete it.' },
        { status: 403 },
      );
    }

    // Defense against a runaway script trying to delete in a loop.
    const rl = await rateLimit({
      key: `company:delete:${ipFromRequest(req)}`,
      limit: DELETE_LIMIT,
      windowSeconds: DELETE_WINDOW_SECONDS,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many delete attempts' },
        { status: 429, headers: rateLimitHeaders(rl, DELETE_LIMIT) },
      );
    }

    const supabase = createServiceClient();
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, deleted_at')
      .eq('id', auth.companyId)
      .single();
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    if (company.deleted_at) {
      return NextResponse.json({ ok: true, already_deleted: true });
    }

    const body = await req.json().catch(() => ({}));
    const confirmPhrase = typeof body.confirm_phrase === 'string' ? body.confirm_phrase : '';
    const expected = `DELETE ${company.name}`;
    if (confirmPhrase !== expected) {
      return NextResponse.json(
        {
          error: `To confirm deletion, type exactly: ${expected}`,
          code: 'confirm_phrase_mismatch',
        },
        { status: 400 },
      );
    }

    // Cancel Stripe subscription if there is one. Best-effort — if the
    // call fails (network, unknown subscription), keep going with the
    // local delete. The user is asking to leave; we shouldn't trap them
    // because Stripe is down.
    const sub = await getSubscriptionForCompany(company.id);
    if (sub?.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
      } catch (err) {
        console.error('Stripe cancel during company delete failed:', err);
      }
    }

    const { error: deleteError } = await supabase
      .from('companies')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', company.id);
    if (deleteError) {
      console.error('[api/company] DELETE:', deleteError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE company error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}