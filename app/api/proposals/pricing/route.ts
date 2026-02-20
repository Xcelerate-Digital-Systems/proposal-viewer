// app/api/proposals/pricing/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// GET — Fetch pricing for a proposal (by proposal_id or share_token)
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const proposalId = req.nextUrl.searchParams.get('proposal_id');
    const shareToken = req.nextUrl.searchParams.get('share_token');

    if (!proposalId && !shareToken) {
      return NextResponse.json({ error: 'proposal_id or share_token required' }, { status: 400 });
    }

    // If share_token provided, look up proposal_id first
    let resolvedProposalId = proposalId;
    if (shareToken && !proposalId) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('share_token', shareToken)
        .single();
      if (!proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }
      resolvedProposalId = proposal.id;
    }

    const { data, error } = await supabase
      .from('proposal_pricing')
      .select('*')
      .eq('proposal_id', resolvedProposalId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows — that's fine, just means no pricing yet
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
  } catch (err) {
    console.error('Pricing GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create or update pricing for a proposal
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { proposal_id, ...pricingData } = body;

    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id is required' }, { status: 400 });
    }

    // Get the proposal's company_id
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, company_id')
      .eq('id', proposal_id)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Check if pricing row already exists
    const { data: existing } = await supabase
      .from('proposal_pricing')
      .select('id')
      .eq('proposal_id', proposal_id)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('proposal_pricing')
        .update({
          ...pricingData,
          updated_at: now,
        })
        .eq('proposal_id', proposal_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('proposal_pricing')
        .insert({
          proposal_id,
          company_id: proposal.company_id,
          ...pricingData,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (err) {
    console.error('Pricing POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}