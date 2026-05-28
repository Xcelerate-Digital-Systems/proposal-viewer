import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const PROPOSAL_ONLY_FIELDS = new Set([
  'id',
  'share_token',
  'status',
  'sent_at',
  'first_viewed_at',
  'last_viewed_at',
  'view_count',
  'accepted_at',
  'accepted_by_name',
  'declined_at',
  'declined_by_name',
  'decline_reason',
  'revision_requested_at',
  'revision_requested_by_name',
  'revision_notes',
  'created_at',
  'updated_at',
  'client_name',
  'client_email',
  'client_organisation',
  'crm_identifier',
  'site_address',
  'estimated_start_date',
  'estimated_duration',
  'show_job_fields',
  'description',
  'file_size_bytes',
  'created_by_name',
  'quote_number',
  'is_test',
  'attachments',
  'scope_of_works',
  'category',
  'valid_until',
  'include_gst',
  'gst_rate',
  'require_deposit',
  'deposit_percent',
  'project_photos',
  'title',
  'page_names',
]);

const RENAME_MAP: Record<string, string> = {
  page_names: 'section_headers',
};

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

  const templateRow: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (PROPOSAL_ONLY_FIELDS.has(k)) continue;
    const destKey = RENAME_MAP[k] ?? k;
    templateRow[destKey] = v;
  }
  templateRow.name = templateName;
  templateRow.description = body.description?.trim() || null;
  templateRow.company_id = auth.companyId;

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
