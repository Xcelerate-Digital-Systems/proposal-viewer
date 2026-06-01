// app/api/review-comments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

async function loadAuthorisedComment(req: NextRequest, id: string) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!auth.member.is_super_admin && auth.accountType !== 'agency') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  const supabase = createServiceClient();
  const { data: comment, error } = await supabase
    .from('review_comments')
    .select('id, company_id, review_item_id, parent_comment_id')
    .eq('id', id)
    .single();

  if (error || !comment) {
    return {
      error: NextResponse.json({ error: 'Comment not found' }, { status: 404 }),
    };
  }

  if (!auth.member.is_super_admin && comment.company_id !== auth.companyId) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { auth, comment, supabase };
}

/**
 * PATCH /api/review-comments/[id]
 * Edit a comment's content. Agency team members only.
 * Body: { content: string }
 */
export async function PATCH(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase } = ctx;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const content = typeof body?.content === 'string' ? body.content.trim() : undefined;
    const priority = typeof body?.priority === 'string' ? body.priority : undefined;
    const validPriorities = ['high', 'medium', 'normal', 'low', 'none'];

    if (!content && !priority) {
      return NextResponse.json({ error: 'Content or priority required' }, { status: 400 });
    }
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (content) updates.content = content;
    if (priority) updates.priority = priority;

    const { data: updated, error: updateErr } = await supabase
      .from('review_comments')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Edit comment error:', updateErr);
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    if (content) {
      try {
        const { syncCommentMentions } = await import('@/lib/feedback/persist-mentions');
        const memberEmail = (ctx.auth.member as { email?: string | null })?.email ?? null;
        await syncCommentMentions(supabase, {
          commentId: params.id,
          content,
          projectId: null,
          actorEmail: memberEmail,
        });
      } catch (err) {
        console.error('Failed to resync mentions on edit:', err);
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Comment PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/review-comments/[id]
 * Delete a comment and any replies + reactions. Agency team members only.
 */
export async function DELETE(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase } = ctx;

    // Delete reactions on this comment and any replies
    const { data: replyIds } = await supabase
      .from('review_comments')
      .select('id')
      .eq('parent_comment_id', params.id);

    const idsToCascade = [params.id, ...(replyIds?.map((r) => r.id) ?? [])];

    await supabase
      .from('review_comment_reactions')
      .delete()
      .in('review_comment_id', idsToCascade);

    // Delete replies first so the parent doesn't foreign-key-fail, then the comment itself.
    if (replyIds && replyIds.length > 0) {
      await supabase
        .from('review_comments')
        .delete()
        .eq('parent_comment_id', params.id);
    }

    const { error: deleteErr } = await supabase
      .from('review_comments')
      .delete()
      .eq('id', params.id);

    if (deleteErr) {
      console.error('Delete comment error:', deleteErr);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Comment DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
