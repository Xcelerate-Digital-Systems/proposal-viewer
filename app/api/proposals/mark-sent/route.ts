// app/api/proposals/mark-sent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { fireWebhooks } from '@/lib/notifications';
import { buildProposalUrl } from '@/lib/proposal-url';
import { enqueueGhlSync, buildProposalSyncPayload } from '@/lib/connectors/ghl/sync';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { proposal_id } = body;
    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the proposal — verify it belongs to this company and is still in draft
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('id, title, client_name, client_email, client_organisation, crm_identifier, share_token, company_id, status, entity_type, quote_number, valid_until, created_at, updated_at, sent_at, first_viewed_at, last_viewed_at, accepted_at, accepted_by_name, declined_at, declined_by_name, decline_reason, revision_requested_at, revision_requested_by_name, revision_notes')
      .eq('id', proposal_id)
      .eq('company_id', auth.companyId)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot mark as sent — current status is "${proposal.status}"` },
        { status: 409 },
      );
    }

    // Update status
    const { error: updateError } = await supabase
      .from('proposals')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', proposal_id);

    if (updateError) {
      console.error('[api/proposals/mark-sent] POST:', updateError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Look up company for custom domain (used to build viewer_url in webhook payload)
    const { data: company } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', proposal.company_id)
      .single();

    const verifiedDomain = company?.domain_verified ? company.custom_domain : null;

    // Fire proposal_sent webhook (non-blocking — errors are logged, not surfaced)
    try {
      const sentAt = new Date().toISOString();
      await fireWebhooks({
        event_type: 'proposal_sent',
        company_id: proposal.company_id,
        custom_domain: verifiedDomain,
        proposal: {
          id:                         proposal.id,
          title:                      proposal.title,
          entity_type:                proposal.entity_type ?? 'proposal',
          status:                     'sent',
          client_name:                proposal.client_name,
          client_email:               proposal.client_email ?? null,
          client_organisation:        proposal.client_organisation ?? null,
          crm_identifier:             proposal.crm_identifier ?? null,
          share_token:                proposal.share_token,
          quote_number:               proposal.quote_number ?? null,
          valid_until:                proposal.valid_until ?? null,
          created_at:                 proposal.created_at,
          updated_at:                 proposal.updated_at,
          sent_at:                    sentAt,
          first_viewed_at:            proposal.first_viewed_at ?? null,
          last_viewed_at:             proposal.last_viewed_at ?? null,
          accepted_at:                proposal.accepted_at ?? null,
          accepted_by_name:           proposal.accepted_by_name ?? null,
          declined_at:                proposal.declined_at ?? null,
          declined_by_name:           proposal.declined_by_name ?? null,
          decline_reason:             proposal.decline_reason ?? null,
          revision_requested_at:      proposal.revision_requested_at ?? null,
          revision_requested_by_name: proposal.revision_requested_by_name ?? null,
          revision_notes:             proposal.revision_notes ?? null,
        },
      });
    } catch (webhookErr) {
      console.error('proposal_sent webhook dispatch error:', webhookErr);
    }

    // Enqueue GHL sync (non-blocking)
    const ghlPayload = buildProposalSyncPayload(proposal);
    if (ghlPayload) {
      const entityType = (proposal.entity_type === 'quote' ? 'quote' : 'proposal') as 'proposal' | 'quote';
      enqueueGhlSync({
        companyId: proposal.company_id,
        entityType,
        entityId: proposal.id,
        fromStage: 'draft',
        toStage: 'sent',
        payload: ghlPayload,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('mark-sent error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}