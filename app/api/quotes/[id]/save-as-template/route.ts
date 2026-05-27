// app/api/quotes/[id]/save-as-template/route.ts
// Snapshots a quote into a new proposal_templates row plus a copy of its
// pricing page. Design / cover fields map column-for-column; quote-specific
// content (scope, GST/deposit settings, badges/about/testimonial/next-steps/
// terms, attachments) lives on the `extra` JSONB column so CreateFromTemplate
// can hydrate a complete quote from it.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Columns that exist on both proposals and proposal_templates and should be
// copied verbatim when snapshotting design + cover state.
const COPY_COLUMNS = [
  'cover_image_path', 'cover_enabled', 'cover_subtitle', 'cover_button_text',
  'cover_bg_style', 'cover_bg_color_1', 'cover_bg_color_2',
  'cover_gradient_type', 'cover_gradient_angle', 'cover_overlay_opacity',
  'cover_text_color', 'cover_subtitle_color', 'cover_button_bg', 'cover_button_text_color',
  'cover_client_logo_path', 'cover_avatar_path', 'cover_date',
  'cover_show_client_logo', 'cover_show_avatar', 'cover_show_date', 'cover_show_prepared_by',
  'prepared_by', 'prepared_by_member_id',
  'bg_image_path', 'bg_image_overlay_opacity', 'bg_image_blur',
  'page_orientation', 'toc_settings',
  'text_page_bg_color', 'text_page_text_color', 'text_page_heading_color',
  'text_page_font_size', 'text_page_border_enabled', 'text_page_border_color',
  'text_page_border_radius', 'text_page_layout',
  'title_font_family', 'title_font_weight', 'title_font_size',
  'page_num_circle_color', 'page_num_text_color',
  'post_accept_action', 'post_accept_redirect_url', 'post_accept_message',
] as const;

// Quote-only fields that don't have a matching column on proposal_templates.
// Persist them in the `extra` JSONB blob so create-from-template can restore
// the full quote shape.
const EXTRA_FIELDS = [
  'scope_of_works', 'category', 'valid_until',
  'include_gst', 'gst_rate', 'require_deposit', 'deposit_percent',
  'quote_extras', 'attachments', 'project_photos', 'site_address',
  'estimated_start_date', 'estimated_duration',
] as const;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name: string = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Load the source quote (must belong to the caller's company)
    const { data: source, error: srcErr } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', params.id)
      .eq('company_id', auth.companyId)
      .single();
    if (srcErr || !source) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (source.entity_type !== 'quote') {
      return NextResponse.json({ error: 'Only quotes can be saved as quote templates here' }, { status: 400 });
    }

    // Build the template row.
    const templateRow: Record<string, unknown> = {
      name,
      description: body.description?.trim() || null,
      entity_type: 'quote',
      company_id: auth.companyId,
      cover_enabled: source.cover_enabled ?? true,
      cover_button_text: source.cover_button_text ?? 'START READING PROPOSAL',
      // file_path isn't applicable for quote templates but the column is
      // non-null on the table. An empty string is fine.
      file_path: '',
    };
    for (const col of COPY_COLUMNS) {
      const v = (source as Record<string, unknown>)[col];
      if (v !== undefined) templateRow[col] = v;
    }

    // Pack quote-only fields into `extra`.
    const extra: Record<string, unknown> = {};
    for (const k of EXTRA_FIELDS) {
      const v = (source as Record<string, unknown>)[k];
      if (v !== undefined && v !== null) extra[k] = v;
    }
    templateRow.extra = extra;

    const { data: tpl, error: insErr } = await supabase
      .from('proposal_templates')
      .insert(templateRow)
      .select('id, name')
      .single();
    if (insErr || !tpl) {
      console.error('[api/quotes/[id]/save-as-template] POST insert:', insErr?.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Copy pricing pages (line items live in proposal_pages_v2.payload).
    const { data: pages } = await supabase
      .from('proposal_pages_v2')
      .select('*')
      .eq('proposal_id', source.id);

    if (pages && pages.length > 0) {
      const targetPages = pages.map((p: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...p };
        delete next.id;
        delete next.proposal_id;
        delete next.created_at;
        delete next.updated_at;
        next.template_id = tpl.id;
        return next;
      });
      const { error: pgErr } = await supabase.from('template_pages_v2').insert(targetPages);
      if (pgErr) {
        // Non-fatal — design carried over even if line items didn't.
        console.error('Template page copy failed (non-fatal):', pgErr.message);
      }
    }

    return NextResponse.json({ success: true, template_id: tpl.id, name: tpl.name });
  } catch (err) {
    console.error('save-as-template error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
