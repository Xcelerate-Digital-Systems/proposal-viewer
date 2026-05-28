// app/api/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { splitProposalPages } from '@/lib/split-proposal-pages';
import { addPage } from '@/lib/page-operations';
import { getCompanyEntityDefaults } from '@/lib/company-defaults';
import { checkResourceLimit, buildLimitErrorBody } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

// Server-controlled fields that must never come from the client.
const PROTECTED_FIELDS = new Set([
  'id', 'company_id', 'share_token', 'status',
  'sent_at', 'accepted_at', 'declined_at', 'revision_requested_at',
  'first_viewed_at', 'last_viewed_at', 'view_count',
  'created_at', 'updated_at',
]);

function stripProtected<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!PROTECTED_FIELDS.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}

/**
 * POST /api/proposals
 *
 * Creates a new proposal record and (for proposals) splits its PDF into
 * per-page rows. Authenticated; the proposal is scoped to the caller's
 * active company_id (super-admins / agency owners can override via
 * ?company_id= as resolved by getAuthContext).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      created_by_name,
      prepared_by,
      entity_type,
      section_headers: _sh,
      ...rest
    } = body;

    const isQuote = entity_type === 'quote';

    if (!title || !client_name) {
      return NextResponse.json(
        { error: 'Missing required fields: title, client_name' },
        { status: 400 },
      );
    }
    if (!isQuote && !file_path) {
      return NextResponse.json(
        { error: 'Missing required field: file_path' },
        { status: 400 },
      );
    }

    const companyId = auth.companyId;

    // ── Plan / subscription enforcement ────────────────────────────────────
    // Counts both proposals and quotes (same table). Founders plan limits are
    // currently NULL = unlimited, so this is a no-op until a capped plan
    // ships. Still runs to enforce subscription-status block (canceled etc).
    const limitCheck = await checkResourceLimit(companyId, 'proposals');
    if (!limitCheck.allowed) {
      return NextResponse.json(buildLimitErrorBody(limitCheck, 'proposals'), { status: 402 });
    }

    // ── Look up company branding defaults ──────────────────────────────────
    const brandingDefaults = await getCompanyEntityDefaults(supabase, companyId, {
      overrides: rest,
    });

    // Strip server-controlled fields from `rest` before spreading.
    const safeRest = stripProtected(rest);

    // Quote numbering — atomic increment of companies.next_quote_number so two
    // simultaneous creates can't collide on the same value. UPDATE…RETURNING
    // does this in a single round-trip.
    let quoteNumber: number | null = null;
    if (isQuote) {
      const { data: counter } = await supabase.rpc('claim_next_quote_number', {
        p_company_id: companyId,
      });
      if (typeof counter === 'number') quoteNumber = counter;
    }

    const { data: proposal, error: insertError } = await supabase
      .from('proposals')
      .insert({
        title,
        client_name,
        client_email:      client_email   || null,
        crm_identifier:    crm_identifier || null,
        description:       description    || null,
        file_path:         file_path      || '',
        file_size_bytes:   file_size_bytes ?? 0,
        status:            'draft',
        page_names:        [],
        company_id:        companyId,
        created_by_name:   created_by_name || null,
        prepared_by:       prepared_by     || created_by_name || null,
        entity_type:       isQuote ? 'quote' : 'proposal',
        quote_number:      quoteNumber,
        ...brandingDefaults,
        ...safeRest,
      })
      .select('id')
      .single();

    if (insertError || !proposal) {
      console.error('[api/proposals] POST insert:', insertError?.message);
      return NextResponse.json(
        { error: 'Failed to create proposal' },
        { status: 500 },
      );
    }

    const proposalId = proposal.id;

    let pageCount = 0;
    if (!isQuote) {
      try {
        const splitResult = await splitProposalPages(proposalId, 'proposal', false);
        pageCount = splitResult.pageCount ?? 0;
      } catch (splitErr) {
        console.error(
          `Non-fatal: failed to split pages for new proposal ${proposalId}:`,
          splitErr,
        );
      }
    } else {
      try {
        await addPage(supabase, 'proposal', {
          entityId:  proposalId,
          companyId,
          type:      'pricing',
          title:     'Pricing',
          position:  0,
        });
        await addPage(supabase, 'proposal', {
          entityId:  proposalId,
          companyId,
          type:      'packages',
          title:     'Packages',
          position:  1,
        });
        await addPage(supabase, 'proposal', {
          entityId:  proposalId,
          companyId,
          type:      'text',
          title:     'Terms & Conditions',
          position:  2,
          payload: {
            content: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Terms & Conditions' }] },
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Payment Terms' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Payment is due within 14 days of invoice. A deposit may be required before work commences.' }] },
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Scope of Work' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'This quote covers the works described in this document only. Any additional work or variations will be quoted separately.' }] },
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Warranty' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'All workmanship is guaranteed for a period of 12 months from the date of completion, unless otherwise specified.' }] },
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Quote Validity' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'This quote is valid for 30 days from the date of issue. Prices may be subject to change after this period.' }] },
              ],
            },
          },
        });
      } catch (pageErr) {
        console.error(`Non-fatal: failed to create default pages for quote ${proposalId}:`, pageErr);
      }
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
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const safeFields = stripProtected(fields);

    const { error } = await supabase
      .from('proposals')
      .update(safeFields)
      .eq('id', id)
      .eq('company_id', auth.companyId);

    if (error) {
      console.error('[api/proposals] PATCH:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Proposal PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
