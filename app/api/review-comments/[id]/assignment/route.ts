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
    .select('id, company_id, assigned_to, review_item_id, content')
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

async function notifyAssigneeAsync(params: {
  commentId: string;
  reviewItemId: string;
  companyId: string;
  assignedToId: string;
  assignedById: string | null;
  assignmentNote: string | null;
  commentContent: string | null;
}) {
  try {
    const supabase = createServiceClient();

    const [{ data: item }, { data: assignee }, { data: assigner }] = await Promise.all([
      supabase
        .from('review_items')
        .select('title, review_project_id')
        .eq('id', params.reviewItemId)
        .maybeSingle(),
      supabase
        .from('team_members')
        .select('id, name, email, user_id')
        .eq('id', params.assignedToId)
        .maybeSingle(),
      params.assignedById
        ? supabase
            .from('team_members')
            .select('name')
            .eq('id', params.assignedById)
            .maybeSingle()
        : { data: null },
    ]);

    if (!item || !assignee?.email) return;

    const { data: project } = await supabase
      .from('review_projects')
      .select('id, title, company_id')
      .eq('id', item.review_project_id)
      .maybeSingle();
    if (!project) return;

    const { data: company } = await supabase
      .from('companies')
      .select('name, logo_path, accent_color')
      .eq('id', project.company_id)
      .maybeSingle();

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const itemUrl = `${appUrl}/campaigns/${project.id}/assets/${params.reviewItemId}`;
    const companyName = company?.name || 'Your agency';
    const accentColor = company?.accent_color || '#017C87';
    const logoUrl = company?.logo_path
      ? supabase.storage.from('company-assets').getPublicUrl(company.logo_path).data.publicUrl
      : null;

    const assignerName = assigner?.name || 'A team member';
    const assigneeName = assignee.name || 'Team member';
    const { htmlToPlainText } = await import('@/lib/feedback/mention-html');
    const plainComment = params.commentContent
      ? htmlToPlainText(params.commentContent).slice(0, 300)
      : null;

    // Email
    try {
      const { getResend, FROM_EMAIL } = await import('@/lib/resend');
      const { buildAssignmentEmail } = await import('@/lib/review-notification-emails');
      const { subject, html } = buildAssignmentEmail({
        branding: { companyName, accentColor, logoUrl },
        projectTitle: project.title,
        itemUrl,
        itemTitle: item.title ?? null,
        assignerName,
        assigneeName,
        commentContent: plainComment,
        assignmentNote: params.assignmentNote,
      });
      await getResend().emails.send({ from: FROM_EMAIL, to: assignee.email, subject, html });
    } catch (err) {
      console.error('Assignment email failed:', err);
    }

    // In-app notification
    try {
      const { insertInAppNotifications, resolveUserIdsForTeamMembers } = await import('@/lib/in-app-notifications');
      const userIds = await resolveUserIdsForTeamMembers(supabase, [params.assignedToId]);
      if (userIds.length > 0) {
        await insertInAppNotifications({
          supabase,
          companyId: params.companyId,
          userIds,
          category: 'review_comment',
          title: `${assignerName} assigned you a task${item.title ? ` on ${item.title}` : ''}`,
          body: plainComment?.slice(0, 200) ?? params.assignmentNote?.slice(0, 200) ?? null,
          link: `/campaigns/${project.id}/assets/${params.reviewItemId}`,
        });
      }
    } catch (err) {
      console.error('Assignment in-app notification failed:', err);
    }
  } catch (err) {
    console.error('Assignment notification dispatch failed:', err);
  }
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
    const { auth, comment, supabase } = ctx;

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

    // Fire-and-forget notification to the assignee
    void notifyAssigneeAsync({
      commentId: params.id,
      reviewItemId: comment.review_item_id as string,
      companyId: comment.company_id as string,
      assignedToId: assignedTo,
      assignedById: memberId,
      assignmentNote: note,
      commentContent: comment.content as string | null,
    });

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
