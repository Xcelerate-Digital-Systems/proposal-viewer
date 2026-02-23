// app/api/proposals/text-pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — Fetch all text pages for a proposal (by proposal_id or share_token)
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
      .from('proposal_text_pages')
      .select('*')
      .eq('proposal_id', resolvedProposalId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Text pages GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create or update a text page
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { proposal_id, id, ...pageData } = body;

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

    const now = new Date().toISOString();

    if (id) {
      // Update existing text page
      const { data, error } = await supabase
        .from('proposal_text_pages')
        .update({
          ...pageData,
          updated_at: now,
        })
        .eq('id', id)
        .eq('proposal_id', proposal_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // Get next sort_order
      const { data: existing } = await supabase
        .from('proposal_text_pages')
        .select('sort_order')
        .eq('proposal_id', proposal_id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

      // Insert new text page
      const { data, error } = await supabase
        .from('proposal_text_pages')
        .insert({
          proposal_id,
          company_id: proposal.company_id,
          ...pageData,
          sort_order: pageData.sort_order ?? nextSort,
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
    console.error('Text pages POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove a text page
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('proposal_text_pages')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Text pages DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}