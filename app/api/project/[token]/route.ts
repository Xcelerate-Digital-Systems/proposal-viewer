// app/api/project/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/project/[token]
 *
 * Public route: loads a review project and all its items for the card grid view.
 * Token is the review_projects.share_token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceClient();

    // Load project by share token
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('*')
      .eq('share_token', params.token)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Don't expose archived projects publicly
    if (project.status === 'archived') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Load all items
    const { data: items } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', project.id)
      .order('sort_order', { ascending: true });

    // Load all comments for all items
    const itemIds = (items || []).map((i: { id: string }) => i.id);
    let comments: unknown[] = [];

    if (itemIds.length > 0) {
      const { data: commentData } = await supabase
        .from('review_comments')
        .select('*')
        .in('review_item_id', itemIds)
        .order('created_at', { ascending: true });

      comments = commentData || [];
    }

    const response = NextResponse.json({
      project,
      items: items || [],
      comments,
    });

    // Prevent browser and CDN caching — always return fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return response;
  } catch (err) {
    console.error('Project grid fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}