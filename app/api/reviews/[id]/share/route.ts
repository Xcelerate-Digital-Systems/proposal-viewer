// app/api/reviews/[id]/share/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

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
    const supabase = createServiceClient();

    // ── Auth check ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Verify project ownership ────────────────────────────
    const { data: member } = await supabase
      .from('team_members')
      .select('company_id, is_super_admin')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, company_id, share_token, board_share_token')
      .eq('id', params.id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only allow access if user belongs to the same company or is super admin
    if (project.company_id !== member.company_id && !member.is_super_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ── Parse body ──────────────────────────────────────────
    const body = await req.json();
    const { view, action, itemId } = body as {
      view: 'items' | 'board' | 'item';
      action: 'generate' | 'revoke';
      itemId?: string;
    };

    if (!view || !action) {
      return NextResponse.json(
        { error: 'Missing view or action' },
        { status: 400 }
      );
    }

    if (view === 'item' && !itemId) {
      return NextResponse.json(
        { error: 'itemId required for item view' },
        { status: 400 }
      );
    }

    // ── Handle token generation / revocation ────────────────

    if (view === 'items') {
      // Project grid share token (uses existing share_token column)
      if (action === 'generate') {
        // share_token is auto-generated on project creation, so it always exists
        // Just return the existing one
        return NextResponse.json({
          token: project.share_token,
          view: 'items',
        });
      } else {
        // For the items view, we don't actually revoke the share_token
        // because it's also used by the widget system. Instead, this is a no-op
        // for now — revocation of the project grid view can be added later
        // with a separate flag like `items_shared: boolean`.
        return NextResponse.json({ revoked: true, view: 'items' });
      }
    }

    if (view === 'board') {
      if (action === 'generate') {
        const newToken = project.board_share_token || crypto.randomUUID();

        if (!project.board_share_token) {
          const { error: updateErr } = await supabase
            .from('review_projects')
            .update({
              board_share_token: newToken,
              updated_at: new Date().toISOString(),
            })
            .eq('id', project.id);

          if (updateErr) {
            return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
          }
        }

        return NextResponse.json({
          token: newToken,
          view: 'board',
        });
      } else {
        const { error: updateErr } = await supabase
          .from('review_projects')
          .update({
            board_share_token: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);

        if (updateErr) {
          return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
        }

        return NextResponse.json({ revoked: true, view: 'board' });
      }
    }

    if (view === 'item') {
      // Verify item belongs to this project
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
            .update({
              share_token: newToken,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          if (updateErr) {
            return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
          }
        }

        return NextResponse.json({
          token: newToken,
          view: 'item',
        });
      } else {
        const { error: updateErr } = await supabase
          .from('review_items')
          .update({
            share_token: null,
            updated_at: new Date().toISOString(),
          })
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