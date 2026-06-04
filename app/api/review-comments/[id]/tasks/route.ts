// app/api/review-comments/[id]/tasks/route.ts
//
// CRUD for comment tasks (multi-assignee action items).
//   GET    — list tasks for a comment
//   POST   — create a new task { assigned_to, instructions?, attachments? }
//   PATCH  — update a task   { task_id, completed?: boolean, instructions?, attachments? }
//   DELETE — remove a task   { task_id }

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
    .select('id, company_id, review_item_id, content')
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

async function notifyTaskAssignee(params: {
  commentId: string;
  reviewItemId: string;
  companyId: string;
  assignedToId: string;
  assignedById: string | null;
  instructions: string | null;
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
      const { fromEmail } = await import('@/lib/resend');
      const { sendAndLogEmail } = await import('@/lib/email-log');
      const { buildTaskEmail } = await import('@/lib/review-notification-emails');
      const { subject, html } = buildTaskEmail({
        branding: { companyName, accentColor, logoUrl },
        projectTitle: project.title,
        itemUrl,
        itemTitle: item.title ?? null,
        assignerName,
        assigneeName,
        commentContent: plainComment,
        instructions: params.instructions,
      });
      await sendAndLogEmail({
        from: fromEmail(companyName), to: assignee.email, subject, html,
        companyId: project.company_id,
        category: 'campaign_task',
        eventType: 'task_assigned',
        entityType: 'campaign',
        entityId: project.id,
      });
    } catch (err) {
      console.error('Task email failed:', err);
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
          body: plainComment?.slice(0, 200) ?? params.instructions?.slice(0, 200) ?? null,
          link: `/campaigns/${project.id}/assets/${params.reviewItemId}`,
        });
      }
    } catch (err) {
      console.error('Task in-app notification failed:', err);
    }
  } catch (err) {
    console.error('Task notification dispatch failed:', err);
  }
}

/**
 * GET /api/review-comments/[id]/tasks
 * List all tasks for this comment.
 */
export async function GET(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase } = ctx;

    const { data: tasks, error } = await supabase
      .from('comment_tasks')
      .select('*')
      .eq('comment_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Tasks list error:', error);
      return NextResponse.json({ error: 'Failed to list tasks' }, { status: 500 });
    }

    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (err) {
    console.error('Tasks GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/review-comments/[id]/tasks
 * Create a new task on this comment.
 * Body: { assigned_to: string, instructions?: string, attachments?: Array<{path,name,size,type}> }
 */
export async function POST(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { auth, comment, supabase } = ctx;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const assignedTo = typeof body?.assigned_to === 'string' ? body.assigned_to.trim() : '';
    const instructions = typeof body?.instructions === 'string' ? body.instructions.trim() : null;
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!assignedTo) {
      return NextResponse.json({ error: 'assigned_to required' }, { status: 400 });
    }

    // Validate team member belongs to same company
    const { data: candidate } = await supabase
      .from('team_members')
      .select('id, company_id')
      .eq('id', assignedTo)
      .single();
    if (!candidate || candidate.company_id !== auth.companyId) {
      return NextResponse.json({ error: 'Invalid team member' }, { status: 400 });
    }

    const memberId = (auth.member as { id?: string }).id ?? null;

    const { data: task, error: insertErr } = await supabase
      .from('comment_tasks')
      .insert({
        comment_id: params.id,
        company_id: auth.companyId,
        assigned_to: assignedTo,
        assigned_by: memberId,
        instructions: instructions || null,
        attachments: attachments.length > 0 ? attachments : [],
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Task create error:', insertErr);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    // Fire-and-forget notification
    void notifyTaskAssignee({
      commentId: params.id,
      reviewItemId: comment.review_item_id as string,
      companyId: comment.company_id as string,
      assignedToId: assignedTo,
      assignedById: memberId,
      instructions,
      commentContent: comment.content as string | null,
    });

    return NextResponse.json(task);
  } catch (err) {
    console.error('Tasks POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/review-comments/[id]/tasks
 * Update a task (toggle completion, update instructions/attachments).
 * Body: { task_id: string, completed?: boolean, instructions?: string, attachments?: Array }
 */
export async function PATCH(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase } = ctx;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const taskId = typeof body?.task_id === 'string' ? body.task_id.trim() : '';
    if (!taskId) {
      return NextResponse.json({ error: 'task_id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body?.completed === 'boolean') {
      updates.completed_at = body.completed ? new Date().toISOString() : null;
    }
    if (typeof body?.instructions === 'string') {
      updates.instructions = body.instructions.trim() || null;
    }
    if (Array.isArray(body?.attachments)) {
      updates.attachments = body.attachments;
    }

    const { data: task, error: updateErr } = await supabase
      .from('comment_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('comment_id', params.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Task update error:', updateErr);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json(task);
  } catch (err) {
    console.error('Tasks PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/review-comments/[id]/tasks
 * Remove a task.
 * Body: { task_id: string }
 */
export async function DELETE(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const ctx = await loadAuthorisedComment(req, params.id);
    if ('error' in ctx) return ctx.error;
    const { supabase } = ctx;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const taskId = typeof body?.task_id === 'string' ? body.task_id.trim() : '';
    if (!taskId) {
      return NextResponse.json({ error: 'task_id required' }, { status: 400 });
    }

    const { error: deleteErr } = await supabase
      .from('comment_tasks')
      .delete()
      .eq('id', taskId)
      .eq('comment_id', params.id);

    if (deleteErr) {
      console.error('Task delete error:', deleteErr);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Tasks DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
