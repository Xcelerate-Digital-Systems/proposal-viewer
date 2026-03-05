// app/api/proposals/packages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — Fetch all packages pages for a proposal (returns array)
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const proposalId = req.nextUrl.searchParams.get('proposal_id');
    const shareToken = req.nextUrl.searchParams.get('share_token');

    if (!proposalId && !shareToken) {
      return NextResponse.json({ error: 'proposal_id or share_token required' }, { status: 400 });
    }

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
      .from('proposal_packages')
      .select('*')
      .eq('proposal_id', resolvedProposalId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Packages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create a new packages page for a proposal
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { proposal_id, ...packagesData } = body;

    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id is required' }, { status: 400 });
    }

    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, company_id')
      .eq('id', proposal_id)
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Determine sort_order from existing count
    const { count } = await supabase
      .from('proposal_packages')
      .select('id', { count: 'exact', head: true })
      .eq('proposal_id', proposal_id);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('proposal_packages')
      .insert({
        proposal_id,
        company_id: proposal.company_id,
        sort_order: count ?? 0,
        ...packagesData,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Packages POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT — Update a packages page by id
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await req.json();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('proposal_packages')
      .update({ ...body, updated_at: now })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Packages PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Delete a packages page by id
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('proposal_packages')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Packages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}