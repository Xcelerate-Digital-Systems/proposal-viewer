// app/api/proposals/[id]/duplicate/route.ts
// Duplicates an existing proposal/quote. Quotes get a fresh quote_number
// from the company's sequence; the duplicate starts as a draft with new
// share_token, cleared accept/decline state, and "Copy of …" prefixed title.
// Pricing pages are copied row-by-row from the unified pages table so line
// items, optional items, and payment schedules carry over.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const FIELDS_TO_OMIT = new Set([
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
  'created_at',
  'updated_at',
  'quote_number',
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const { data: source, error: srcErr } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', auth.companyId)
    .single();
  if (srcErr || !source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  // Build the new row — strip server-controlled / unique fields.
  const insertRow: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (!FIELDS_TO_OMIT.has(k)) insertRow[k] = v;
  }
  insertRow.title = `Copy of ${source.title ?? 'Untitled'}`.slice(0, 240);
  insertRow.status = 'draft';
  insertRow.share_token = randomUUID();

  // Quotes get a fresh number.
  if (source.entity_type === 'quote') {
    const { data: counter } = await supabase.rpc('claim_next_quote_number', {
      p_company_id: auth.companyId,
    });
    if (typeof counter === 'number') insertRow.quote_number = counter;
  }

  const { data: copy, error: insErr } = await supabase
    .from('proposals')
    .insert(insertRow)
    .select('id, share_token')
    .single();
  if (insErr || !copy) {
    return NextResponse.json({ error: insErr?.message ?? 'Insert failed' }, { status: 500 });
  }

  // Copy pricing/text/packages pages over from the unified proposal_pages_v2
  // table. Drop ids/timestamps so Postgres regenerates them on insert.
  const { data: pages } = await supabase
    .from('proposal_pages_v2')
    .select('*')
    .eq('proposal_id', source.id);

  if (pages && pages.length > 0) {
    const newPages = pages.map((p: Record<string, unknown>) => {
      const next: Record<string, unknown> = { ...p };
      delete next.id;
      delete next.created_at;
      delete next.updated_at;
      next.proposal_id = copy.id;
      return next;
    });
    const { error: pageErr } = await supabase.from('proposal_pages_v2').insert(newPages);
    if (pageErr) {
      console.error('Page copy failed (non-fatal):', pageErr.message);
    }
  }

  return NextResponse.json({ success: true, id: copy.id });
}
