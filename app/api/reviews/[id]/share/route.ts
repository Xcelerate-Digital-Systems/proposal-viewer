// app/api/reviews/[id]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

/**
 * POST /api/reviews/[id]/share
 *
 * Generate or revoke a share token for a specific view.
 *
 * Body:
 *   view:    'items' | 'board' | 'item'
 *   action:  'generate' | 'revoke'
 *   itemId?: string  (required when view === 'item')
 *
 * Returns:
 *   { token: string, url: string }   — on generate
 *   { revoked: true }                — on revoke
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Creative Review is agency-only
    if (auth.accountType !== 'agency') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Verify project ownership
    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, company_id, share_token, board_share_token')
      .eq('id', params.id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.company_id !== auth.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse body
    const body = await req.json();
    const { view, action, itemId } = body as {
      view: 'items' | 'board' | 'item';
      action: 'generate' | 'revoke';
      itemId?: string;
    };

    if (!view || !action) {
      return NextResponse.json({ error: 'Missing view or action' }, { status: 400 });
    }

    if (view === 'item' && !itemId) {
      return NextResponse.json({ error: 'itemId required for item view' }, { status: 400 });
    }

    // ── Handle token generation / revocation ────────────────────

    if (view === 'items') {
      if (action === 'generate') {
        return NextResponse.json({ token: project.share_token, view: 'items' });
      } else {
        // Revocation of the project grid view is a no-op for now
        // (share_token is also used by the widget system)
        return NextResponse.json({ revoked: true, view: 'items' });
      }
    }

    if (view === 'board') {
      if (action === 'generate') {
        const newToken = project.board_share_token || crypto.randomUUID();

        if (!project.board_share_token) {
          const { error: updateErr } = await supabase
            .from('review_projects')
            .update({ board_share_token: newToken, updated_at: new Date().toISOString() })
            .eq('id', project.id);

          if (updateErr) {
            return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
          }
        }

        return NextResponse.json({ token: newToken, view: 'board' });
      } else {
        const { error: updateErr } = await supabase
          .from('review_projects')
          .update({ board_share_token: null, updated_at: new Date().toISOString() })
          .eq('id', project.id);

        if (updateErr) {
          return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
        }

        return NextResponse.json({ revoked: true, view: 'board' });
      }
    }

    if (view === 'item') {
      const { data: item, error: itemErr } = await supabase
        .from('review_items')
        .select('id, share_token')
        .eq('id', itemId)
        .eq('review_project_id', project.id)
        .single();

      if (itemErr || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      if (action === 'generate') {
        const newToken = item.share_token || crypto.randomUUID();

        if (!item.share_token) {
          const { error: updateErr } = await supabase
            .from('review_items')
            .update({ share_token: newToken, updated_at: new Date().toISOString() })
            .eq('id', item.id);

          if (updateErr) {
            return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
          }
        }

        return NextResponse.json({ token: newToken, view: 'item' });
      } else {
        const { error: updateErr } = await supabase
          .from('review_items')
          .update({ share_token: null, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        if (updateErr) {
          return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
        }

        return NextResponse.json({ revoked: true, view: 'item' });
      }
    }

    return NextResponse.json({ error: 'Invalid view type' }, { status: 400 });
  } catch (err) {
    console.error('Share API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}