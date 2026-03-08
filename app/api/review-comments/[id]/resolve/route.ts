// app/api/review-comments/[id]/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

// PATCH - Resolve or unresolve a comment
export async function PATCH(
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

    const body = await req.json();
    const { resolved, resolved_by } = body;

    const supabase = createServiceClient();

    // Verify the comment exists and belongs to the user's company
    const { data: comment, error: commentErr } = await supabase
      .from('review_comments')
      .select('id, company_id, review_item_id, resolved')
      .eq('id', params.id)
      .single();

    if (commentErr || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check company access (getAuthContext already handles super admin override)
    if (comment.company_id !== auth.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update resolve status
    const updateData: Record<string, unknown> = {
      resolved: !!resolved,
      resolved_by: resolved ? (resolved_by || auth.member.email || 'Team') : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    };

    const { data: updated, error: updateErr } = await supabase
      .from('review_comments')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Resolve error:', updateErr);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    // Fire notification if resolving (not unresolving)
    if (resolved) {
      try {
        const { data: itemData } = await supabase
          .from('review_items')
          .select('title, review_project_id')
          .eq('id', comment.review_item_id)
          .single();

        if (itemData) {
          const { data: projectData } = await supabase
            .from('review_projects')
            .select('share_token')
            .eq('id', itemData.review_project_id)
            .single();

          if (projectData) {
            const notifyUrl = new URL('/api/review-notify', req.url);
            fetch(notifyUrl.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_type: 'review_comment_resolved',
                share_token: projectData.share_token,
                review_item_id: comment.review_item_id,
                resolved_by: resolved_by || auth.member.email || 'Team',
                item_title: itemData.title,
                author_type: 'team',
              }),
            }).catch(() => {});
          }
        }
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Resolve API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}