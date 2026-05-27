// app/api/review-comments/[id]/assignment/route.ts
//
// Assign a comment to a team member for actioning (internal-only).
//   POST   — create/update assignment { assigned_to, note? }
//   PATCH  — mark assignment complete (or reopen)
//   DELETE — remove assignment

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { getAuthContext } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

async function loadAuthorisedComment(req: NextRequest, commentId: string) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!auth.member.is_super_admin && auth.accountType !== 'agency') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const supabase = createServiceClient();
  const { data: comment, error } = await supabase
    .from('review_comments')
    .select('id, company_id, assigned_to')
    .eq('id', commentId)
    .single();

  if (error || !comment) {
    return { error: NextResponse.json({ error: 'Comment not found' }, { status: 404 }) };
  }
  if (!auth.member.is_super_admin && comment.company_id !== auth.companyId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { auth, comment, supabase };
}

/**
 * POST /api/review-comments/[id]/assignment
 * Create or update an assignment on this comment.
 * Body: { assigned_to: string (team_member_id), note?: string }
 */
export async function POST(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { auth, supabase } = ctx;

    const body = await req.json();
    const assignedTo = typeof body?.assigned_to === 'string' ? body.assigned_to.trim() : '';
    const note = typeof body?.note === 'string' ? body.note.trim() : null;

    if (!assignedTo) {
      return NextResponse.json({ error: 'assigned_to required' }, { status: 400 });
    }

    const { data: candidate } = await supabase
      .from('team_members')
      .select('id, company_id')
      .eq('id', assignedTo)
      .single();
    if (!candidate || candidate.company_id !== auth.companyId) {
      return NextResponse.json({ error: 'Invalid team member' }, { status: 400 });
    }

    const memberId = (auth.member as { id?: string }).id ?? null;

    const { data: updated, error: updateErr } = await supabase
      .from('review_comments')
      .update({
        assigned_to: assignedTo,
        assigned_by: memberId,
        assignment_note: note || null,
        assignment_completed_at: null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Assignment create error:', updateErr);
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Assignment POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/review-comments/[id]/assignment
 * Toggle assignment completion.
 * Body: { completed: boolean }
 */
export async function PATCH(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase, comment } = ctx;

    if (!comment.assigned_to) {
      return NextResponse.json({ error: 'No assignment on this comment' }, { status: 400 });
    }

    const body = await req.json();
    const completed = body?.completed === true;

    const { data: updated, error: updateErr } = await supabase
      .from('review_comments')
      .update({
        assignment_completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Assignment toggle error:', updateErr);
      return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Assignment PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/review-comments/[id]/assignment
 * Remove the assignment entirely.
 */
export async function DELETE(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase } = ctx;

    const { data: updated, error: updateErr } = await supabase
      .from('review_comments')
      .update({
        assigned_to: null,
        assigned_by: null,
        assignment_note: null,
        assignment_completed_at: null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Assignment delete error:', updateErr);
      return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Assignment DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
