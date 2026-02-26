// app/api/whiteboard/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

/**
 * GET /api/whiteboard/[token]
 *
 * Public route: loads a review project, items, and board data for the
 * whiteboard canvas view.
 * Token is the review_projects.board_share_token.
 *
 * Uses the get_whiteboard_data() RPC function to fetch all data in one
 * call, bypassing PostgREST schema cache issues with newer columns.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc('get_whiteboard_data', {
      p_board_token: params.token,
    });

    if (error) {
      console.error('Whiteboard RPC error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // The function returns { error: 'not_found' } if token is invalid
    if (!data || data.error === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      project: data.project,
      items: data.items || [],
      comments: data.comments || [],
      boardEdges: data.boardEdges || [],
      boardNotes: data.boardNotes || [],
    });
  } catch (err) {
    console.error('Whiteboard fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}