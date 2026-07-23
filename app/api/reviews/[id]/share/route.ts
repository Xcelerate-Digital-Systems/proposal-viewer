// app/api/reviews/[id]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';
import { DEFAULT_SHARED_VIEWS, type FeedbackSharedViews } from '@/lib/types/feedback';
import { authRateLimit } from '@/lib/rate-limit';
import { hashSharePassword } from '@/lib/feedback/share-password';

/**
 * PATCH /api/reviews/[id]/share
 *
 * Update sharing settings:
 * - shared_views: { board: boolean; kanban: boolean; items: boolean }
 * - share_password: string | null — set or clear the share link password
 * - share_expires_at: string | null — ISO timestamp or null to remove expiry
 */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = await authRateLimit(auth.companyId, 'reviews/share');
    if (limited) return limited;


    const supabase = createServiceClient();

    const { data: project, error: projErr } = await supabase
      .from('review_projects')
      .select('id, company_id')
      .eq('id', params.id)
      .single();

    if (projErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Super admins (jack viewing a client project) bypass the company-id
    // ownership check; everyone else must match the project's company.
    const isSuperAdmin = (auth.member as { is_super_admin?: boolean } | null)?.is_super_admin === true;
    if (!isSuperAdmin && project.company_id !== auth.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // ── Shared views ──
    if (body.shared_views) {
      const incoming = (body.shared_views ?? {}) as Partial<FeedbackSharedViews>;
      const next: FeedbackSharedViews = {
        board: typeof incoming.board === 'boolean' ? incoming.board : DEFAULT_SHARED_VIEWS.board,
        kanban: typeof incoming.kanban === 'boolean' ? incoming.kanban : DEFAULT_SHARED_VIEWS.kanban,
        items: typeof incoming.items === 'boolean' ? incoming.items : DEFAULT_SHARED_VIEWS.items,
      };
      updatePayload.shared_views = next;
    }

    // ── Password ──
    if ('share_password' in body) {
      if (body.share_password === null || body.share_password === '') {
        // Clear password
        updatePayload.share_password_hash = null;
      } else if (typeof body.share_password === 'string' && body.share_password.trim()) {
        // Set new password (min 4 chars)
        const pw = body.share_password.trim();
        if (pw.length < 4) {
          return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
        }
        updatePayload.share_password_hash = hashSharePassword(pw);
      }
    }

    // ── Expiry ──
    if ('share_expires_at' in body) {
      if (body.share_expires_at === null || body.share_expires_at === '') {
        updatePayload.share_expires_at = null;
      } else if (typeof body.share_expires_at === 'string') {
        const parsed = new Date(body.share_expires_at);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
        }
        updatePayload.share_expires_at = parsed.toISOString();
      }
    }

    const { error: updateErr } = await supabase
      .from('review_projects')
      .update(updatePayload)
      .eq('id', project.id);

    if (updateErr) return NextResponse.json({ error: 'Failed to update sharing settings' }, { status: 500 });

    // Fetch updated project to return current state
    const { data: updated } = await supabase
      .from('review_projects')
      .select('shared_views, share_password_hash, share_expires_at')
      .eq('id', project.id)
      .single();

    return NextResponse.json({
      shared_views: updated?.shared_views ?? updatePayload.shared_views,
      has_password: !!updated?.share_password_hash,
      share_expires_at: updated?.share_expires_at ?? null,
    });
  } catch (err) {
    console.error('Share PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Feedback is agency-only
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
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { view, action, itemId } = rawBody as {
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