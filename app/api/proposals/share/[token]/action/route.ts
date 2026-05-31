// app/api/proposals/share/[token]/action/route.ts
//
// Public viewer mutations on a proposal, authenticated by knowledge of the
// share_token. Replaces direct anon-client `supabase.from('proposals').update(...)`
// calls in hooks/useProposalActions.ts and hooks/useProposal.ts so we can
// REVOKE UPDATE on proposals from anon entirely. The share_token in the URL
// is the only credential — anyone who knows it can take any of the actions
// below on THAT proposal only.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { enqueueGhlSync, buildProposalSyncPayload } from '@/lib/connectors/ghl/sync';
import { getResend, FROM_EMAIL } from '@/lib/resend';
import { buildProposalUrl } from '@/lib/proposal-url';
import { buildClientConfirmationEmail, type ClientDecisionAction } from '@/lib/notification-emails';

export const dynamic = 'force-dynamic';

const ACTION_LIMIT = 30;
const ACTION_WINDOW_SECONDS = 60;

type Action = 'accept' | 'decline' | 'request_revision' | 'view';

interface Body {
  action?: Action;
  name?: string;
  reason?: string;
  notes?: string;
  viewer_email?: string;
}

const VALID_ACTIONS: Action[] = ['accept', 'decline', 'request_revision', 'view'];

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const supabase = createServiceClient();

  // Per-share_token throttle. 30/min comfortably covers a legitimate
  // session (page load = 1 view, optional accept/decline, periodic re-views)
  // but blocks a flood from a leaked token.
  const rl = await rateLimit({
    key: `proposal-action:${params.token}`,
    limit: ACTION_LIMIT,
    windowSeconds: ACTION_WINDOW_SECONDS,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests for this proposal' },
      { status: 429, headers: rateLimitHeaders(rl, ACTION_LIMIT) },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action;

  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }

  // Resolve the proposal by share_token. This is the auth check — if the
  // token doesn't match a real proposal, 404.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, status, first_viewed_at, company_id, title, client_name, client_email, client_organisation, entity_type')
    .eq('share_token', params.token)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const now = new Date().toISOString();

  // GHL sync helper — non-blocking, fire-and-forget
  const triggerGhlSync = (fromStatus: string, toStatus: string) => {
    const ghlPayload = buildProposalSyncPayload(proposal);
    if (ghlPayload) {
      const entityType = (proposal.entity_type === 'quote' ? 'quote' : 'proposal') as 'proposal' | 'quote';
      enqueueGhlSync({
        companyId: proposal.company_id,
        entityType,
        entityId: proposal.id,
        fromStage: fromStatus,
        toStage: toStatus,
        payload: ghlPayload,
      });
    }
  };

  // Fire-and-forget client confirmation email
  const sendClientConfirmation = (decisionAction: ClientDecisionAction) => {
    const clientEmail = (typeof body.viewer_email === 'string' && body.viewer_email.trim())
      ? body.viewer_email.trim()
      : proposal.client_email;
    if (!clientEmail) return;

    // Fetch company branding (name + logo) then send — non-blocking
    (async () => {
      try {
        const { data: company } = await supabase
          .from('companies')
          .select('name, logo_url, custom_domain, domain_verified')
          .eq('id', proposal.company_id)
          .single();

        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const verifiedDomain = company?.domain_verified ? company.custom_domain : null;
        const viewerUrl = buildProposalUrl(params.token, verifiedDomain, appUrl);
        const companyName = company?.name || 'Your agency';

        const { subject, html } = buildClientConfirmationEmail({
          action: decisionAction,
          proposalTitle: proposal.title,
          companyName,
          companyLogo: company?.logo_url || null,
          viewerUrl,
          entityType: proposal.entity_type ?? undefined,
        });

        await getResend().emails.send({ from: FROM_EMAIL, to: clientEmail, subject, html });
      } catch (err) {
        console.error('[api/proposals/share/[token]/action] confirmation email error:', err);
      }
    })();
  };

  if (action === 'accept') {
    const name = typeof body.name === 'string' ? body.name.slice(0, 200) : '';
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const { error } = await supabase
      .from('proposals')
      .update({ status: 'accepted', accepted_at: now, accepted_by_name: name })
      .eq('id', proposal.id);
    if (error) {
      console.error('[api/proposals/share/[token]/action] accept:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    triggerGhlSync(proposal.status, 'accepted');
    sendClientConfirmation('accepted');
    return NextResponse.json({ success: true });
  }

  if (action === 'decline') {
    const name = typeof body.name === 'string' ? body.name.slice(0, 200) : '';
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 5000) : '';
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const { error } = await supabase
      .from('proposals')
      .update({
        status: 'declined',
        declined_at: now,
        declined_by_name: name,
        decline_reason: reason,
      })
      .eq('id', proposal.id);
    if (error) {
      console.error('[api/proposals/share/[token]/action] decline:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    triggerGhlSync(proposal.status, 'declined');
    sendClientConfirmation('declined');
    return NextResponse.json({ success: true });
  }

  if (action === 'request_revision') {
    const name = typeof body.name === 'string' ? body.name.slice(0, 200) : '';
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : '';
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const { error } = await supabase
      .from('proposals')
      .update({
        status: 'revision_requested',
        revision_requested_at: now,
        revision_requested_by_name: name,
        revision_notes: notes,
      })
      .eq('id', proposal.id);
    if (error) {
      console.error('[api/proposals/share/[token]/action] request_revision:', error.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    triggerGhlSync(proposal.status, 'revision_requested');
    sendClientConfirmation('revision_requested');
    return NextResponse.json({ success: true });
  }

  // action === 'view'
  // Drafts never count as views (admin QA shouldn't tick the "first seen by
  // client" timer). Match the previous client-side guard.
  if (proposal.status === 'draft') return NextResponse.json({ success: true });

  const isFirstView = !proposal.first_viewed_at;
  const updates: Record<string, string> = { last_viewed_at: now };
  if (isFirstView) updates.first_viewed_at = now;
  if (proposal.status === 'sent') updates.status = 'viewed';

  await supabase.from('proposals').update(updates).eq('id', proposal.id);
  await supabase.from('proposal_views').insert({
    proposal_id: proposal.id,
    user_agent: req.headers.get('user-agent') ?? null,
    company_id: proposal.company_id,
  });

  // GHL sync only on first status transition to 'viewed'
  if (proposal.status === 'sent') {
    triggerGhlSync('sent', 'viewed');
  }

  return NextResponse.json({ success: true, first_view: isFirstView });
}
