// app/api/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { splitProposalPages } from '@/lib/split-proposal-pages';

export const dynamic = 'force-dynamic';

/**
 * POST /api/proposals
 *
 * Creates a new proposal record and immediately splits its PDF into
 * per-page rows in proposal_pages. This replaces the direct client-side
 * supabase.from('proposals').insert() in UploadModal.
 *
 * The client still uploads the PDF directly to Supabase Storage via XHR
 * (to bypass Vercel's 4.5 MB body limit). It then calls this endpoint
 * with the resulting file_path and all other proposal fields.
 *
 * Body: all proposal insert fields (title, client_name, file_path, etc.)
 *   plus company_id (required for RLS) and created_by_name.
 *
 * Response:
 *   { success: true, proposal_id: string, page_count: number }
 *
 * Split failures are non-fatal — the proposal is returned even if
 * split fails, so the backfill route can be used later.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const {
      title,
      client_name,
      client_email,
      crm_identifier,
      description,
      file_path,
      file_size_bytes,
      company_id,
      created_by_name,
      prepared_by,
      // Allow any additional fields (template-copied cover fields, etc.)
      ...rest
    } = body;

    if (!title || !client_name || !file_path || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields: title, client_name, file_path, company_id' },
        { status: 400 },
      );
    }

    // ── Insert the proposal record ────────────────────────────────────────
    const { data: proposal, error: insertError } = await supabase
      .from('proposals')
      .insert({
        title,
        client_name,
        client_email:      client_email   || null,
        crm_identifier:    crm_identifier || null,
        description:       description    || null,
        file_path,
        file_size_bytes:   file_size_bytes ?? 0,
        status:            'draft',
        page_names:        [],
        company_id,
        created_by_name:   created_by_name || null,
        prepared_by:       prepared_by     || created_by_name || null,
        ...rest,
      })
      .select('id')
      .single();

    if (insertError || !proposal) {
      console.error('Proposal insert error:', insertError?.message);
      return NextResponse.json(
        { error: insertError?.message ?? 'Failed to create proposal' },
        { status: 500 },
      );
    }

    const proposalId = proposal.id;

    // ── Split PDF into per-page rows ──────────────────────────────────────
    // Non-fatal: if split fails, the proposal still exists and can be
    // backfilled later via POST /api/proposals/split.
    let pageCount = 0;
    try {
      const splitResult = await splitProposalPages(proposalId, 'proposal', false);
      pageCount = splitResult.pageCount ?? 0;
    } catch (splitErr) {
      console.error(
        `Non-fatal: failed to split pages for new proposal ${proposalId}:`,
        splitErr,
      );
    }

    return NextResponse.json({
      success:     true,
      proposal_id: proposalId,
      page_count:  pageCount,
    });
  } catch (err) {
    console.error('Proposal POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — Update top-level fields on a proposal (e.g. page_order)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('proposals')
      .update(fields)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Proposal PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}