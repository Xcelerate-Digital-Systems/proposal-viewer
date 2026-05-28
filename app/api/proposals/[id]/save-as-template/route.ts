import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Columns that exist on both proposals and proposal_templates and should be
// copied verbatim when snapshotting a proposal into a template.
const COPY_COLUMNS = [
  'entity_type', 'file_path',
  'cover_image_path', 'cover_enabled', 'cover_subtitle', 'cover_button_text',
  'cover_bg_style', 'cover_bg_color_1', 'cover_bg_color_2',
  'cover_gradient_type', 'cover_gradient_angle',
  'cover_gradient_position_x', 'cover_gradient_position_y',
  'cover_gradient_stops', 'cover_overlay_opacity',
  'cover_text_color', 'cover_subtitle_color',
  'cover_button_bg', 'cover_button_text_color',
  'cover_client_logo_path', 'cover_client_logo_tint_color',
  'cover_avatar_path', 'cover_date',
  'cover_show_client_logo', 'cover_show_avatar',
  'cover_show_date', 'cover_show_prepared_by',
  'prepared_by', 'prepared_by_member_id',
  'bg_image_path', 'bg_image_overlay_opacity', 'bg_image_blur',
  'page_orientation', 'toc_settings', 'page_order',
  'text_page_bg_color', 'text_page_text_color', 'text_page_heading_color',
  'text_page_font_size', 'text_page_border_enabled', 'text_page_border_color',
  'text_page_border_radius', 'text_page_layout',
  'title_font_family', 'title_font_weight', 'title_font_size',
  'title_font_transform',
  'font_heading_family', 'font_heading_weight', 'font_heading_size',
  'font_heading_transform',
  'font_body_family', 'font_body_weight', 'font_body_transform',
  'font_button_family', 'font_button_weight',
  'page_num_circle_color', 'page_num_text_color',
  'quote_page_bg_color',
  'quote_header_bg_color_1', 'quote_header_bg_color_2',
  'quote_header_text_color', 'quote_header_subtitle_color',
  'post_accept_action', 'post_accept_redirect_url', 'post_accept_message',
  'package_styling',
  'decision_action_bg_color', 'decision_action_text_color',
  'decision_action_heading_color', 'decision_action_accent_color',
  'decision_decline_button_color', 'decision_revision_button_color',
  'decision_checkbox_color',
  'decision_page_enabled', 'decision_page_title', 'decision_extras',
  'pricing_header_text_color', 'pricing_text_color',
  'pricing_price_title_color', 'pricing_price_color',
  'pricing_payment_schedule_name_color', 'pricing_payment_schedule_price_color',
  'pricing_accent_bar_color', 'pricing_dot_color',
] as const;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json().catch(() => ({}));
  const templateName: string = body.name?.trim();

  if (!templateName) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const { data: source, error: srcErr } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', auth.companyId)
    .single();

  if (srcErr || !source) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const templateRow: Record<string, unknown> = {
    name: templateName,
    description: body.description?.trim() || null,
    company_id: auth.companyId,
    section_headers: source.page_names ?? null,
    entity_type: source.entity_type || 'proposal',
    file_path: (source as Record<string, unknown>).file_path || '',
  };
  for (const col of COPY_COLUMNS) {
    if (col === 'file_path' || col === 'entity_type') continue;
    const v = (source as Record<string, unknown>)[col];
    if (v !== undefined && v !== null) templateRow[col] = v;
  }

  const { data: template, error: tmplErr } = await supabase
    .from('proposal_templates')
    .insert(templateRow)
    .select('id')
    .single();

  if (tmplErr || !template) {
    console.error('[save-as-template] insert:', tmplErr?.message);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  const { data: pages } = await supabase
    .from('proposal_pages_v2')
    .select('*')
    .eq('proposal_id', source.id)
    .order('position', { ascending: true });

  if (pages && pages.length > 0) {
    const newPages = pages.map((p: Record<string, unknown>) => {
      const next: Record<string, unknown> = { ...p };
      delete next.id;
      delete next.created_at;
      delete next.updated_at;
      delete next.proposal_id;
      next.template_id = template.id;
      next.company_id = auth.companyId;
      return next;
    });
    const { error: pageErr } = await supabase.from('template_pages_v2').insert(newPages);
    if (pageErr) {
      console.error('[save-as-template] page copy failed:', pageErr.message);
    }
  }

  const pageCount = pages?.length ?? 0;
  await supabase
    .from('proposal_templates')
    .update({ page_count: pageCount })
    .eq('id', template.id);

  return NextResponse.json({ success: true, template_id: template.id });
}
