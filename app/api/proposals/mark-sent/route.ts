// app/api/proposals/mark-sent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { fireWebhooks } from '@/lib/notifications';
import { buildProposalUrl } from '@/lib/proposal-url';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the proposal — verify it belongs to this company and is still in draft
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('id, title, client_name, client_email, crm_identifier, share_token, company_id, status')
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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
      await fireWebhooks({
        event_type: 'proposal_sent',
        company_id: proposal.company_id,
        custom_domain: verifiedDomain,
        proposal: {
          id: proposal.id,
          title: proposal.title,
          client_name: proposal.client_name,
          client_email: proposal.client_email ?? null,
          crm_identifier: proposal.crm_identifier ?? null,
          share_token: proposal.share_token,
        },
      });
    } catch (webhookErr) {
      console.error('proposal_sent webhook dispatch error:', webhookErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('mark-sent error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}