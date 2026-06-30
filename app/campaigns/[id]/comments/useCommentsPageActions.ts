'use client';

import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment } from '@/lib/supabase';
import type { CommentTask, CommentTaskAttachment, FeedbackCommentPriority } from '@/lib/types/feedback';
import type { CommentWithItem } from '@/components/admin/feedback/feedback-list/types';

/* ------------------------------------------------------------------ */
/*  Hook: all mutation callbacks for the comments page                 */
/* ------------------------------------------------------------------ */

interface UseCommentsPageActionsArgs {
  projectId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { id?: string; name?: string; email?: string } | null;
  project: FeedbackProject | null;
  items: FeedbackItem[];
  authorName: string;
  memberNameMap: Record<string, string>;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
  confirm: (opts: { title: string; message: string; confirmLabel: string; destructive: boolean }) => Promise<boolean>;
  setAllComments: React.Dispatch<React.SetStateAction<FeedbackComment[]>>;
  setAllTasks: React.Dispatch<React.SetStateAction<CommentTask[]>>;
  setSelectedComment: React.Dispatch<React.SetStateAction<CommentWithItem | null>>;
}

export function useCommentsPageActions({
  projectId,
  companyId,
  session,
  teamMember,
  project,
  items,
  authorName,
  memberNameMap,
  toast,
  confirm,
  setAllComments,
  setAllTasks,
  setSelectedComment,
}: UseCommentsPageActionsArgs) {

  // ── Reply ─────────────────────────────────────────────────────────
  const handleSubmitReply = async (parent: CommentWithItem, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    const insertData: Record<string, unknown> = {
      review_item_id: parent.review_item_id ?? null,
      review_project_id: parent.review_project_id ?? projectId,
      company_id: companyId,
      parent_comment_id: parent.id,
      thread_number: null,
      author_name: authorName,
      author_email: teamMember?.email || null,
      author_user_id: session?.user?.id || null,
      author_type: 'team',
      content: trimmed,
      comment_type: 'general',
      pin_x: null,
      pin_y: null,
      version_id: parent.version_id ?? null,
    };

    const { data, error } = await supabase
      .from('review_comments')
      .insert(insertData)
      .select()
      .single();

    if (error || !data) {
      toast.error('Failed to post reply');
      return false;
    }

    setAllComments((prev) => [...prev, data as FeedbackComment]);

    if (project?.share_token) {
      const item = parent.review_item_id
        ? items.find((i) => i.id === parent.review_item_id)
        : null;
      fetch('/api/review-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'review_comment_added',
          share_token: project.share_token,
          review_item_id: parent.review_item_id ?? null,
          review_comment_id: data.id,
          comment_author: authorName,
          comment_author_email: teamMember?.email || null,
          author_user_id: session?.user?.id || null,
          comment_content: trimmed,
          item_title: item?.title ?? project.title,
          parent_comment_id: parent.id,
          author_type: 'team',
        }),
      }).catch(() => {});
    }

    return true;
  };

  // ── Submit new project-level comment ─────────────────────────────
  const handleSubmitGeneralComment = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    const insertData: Record<string, unknown> = {
      review_item_id: null,
      review_project_id: projectId,
      company_id: companyId,
      parent_comment_id: null,
      thread_number: null,
      author_name: authorName,
      author_email: teamMember?.email || null,
      author_user_id: session?.user?.id || null,
      author_type: 'team',
      content: trimmed,
      comment_type: 'general',
      pin_x: null,
      pin_y: null,
    };

    const { data, error } = await supabase
      .from('review_comments')
      .insert(insertData)
      .select()
      .single();

    if (error || !data) {
      toast.error('Failed to post comment');
      return false;
    }

    setAllComments((prev) => [data as FeedbackComment, ...prev]);

    if (project?.share_token) {
      fetch('/api/review-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'review_comment_added',
          share_token: project.share_token,
          review_comment_id: data.id,
          comment_author: authorName,
          comment_author_email: teamMember?.email || null,
          author_user_id: session?.user?.id || null,
          comment_content: trimmed,
          item_title: project.title,
          author_type: 'team',
        }),
      }).catch(() => {});
    }

    return true;
  };

  // ── Delete ────────────────────────────────────────────────────────
  const handleDeleteComment = async (comment: CommentWithItem) => {
    const ok = await confirm({
      title: 'Delete comment?',
      message: 'This deletes the comment and all replies. Cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const token = session ? (await supabase.auth.getSession()).data.session?.access_token : null;
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    const res = await fetch(`/api/review-comments/${comment.id}?company_id=${companyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Failed to delete comment');
      return;
    }

    setAllComments((prev) =>
      prev.filter((c) => c.id !== comment.id && c.parent_comment_id !== comment.id)
    );
    setAllTasks((prev) => prev.filter((t) => t.comment_id !== comment.id));
    setSelectedComment(null);
    toast.success('Comment deleted');
  };

  // ── Resolve ───────────────────────────────────────────────────────
  const handleToggleResolve = async (comment: CommentWithItem, resolved: boolean) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${comment.id}/resolve?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved, resolved_by: authorName }),
    });

    if (res.ok) {
      const updated = await res.json();
      setAllComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, resolved: updated.resolved, resolved_at: updated.resolved_at } : c))
      );
      setSelectedComment((prev) =>
        prev?.id === comment.id ? { ...prev, resolved: updated.resolved, resolved_at: updated.resolved_at } : prev
      );
    }
  };

  // ── Task callbacks ────────────────────────────────────────────────
  const quickAssign = async (commentId: string, memberId: string, instructions: string) => {
    await createTask(commentId, memberId, instructions, []);
  };

  const createTask = async (commentId: string, memberId: string, instructions: string, attachments: CommentTaskAttachment[]) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${commentId}/tasks?company_id=${companyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: memberId, instructions: instructions || undefined, attachments }),
    });
    if (!res.ok) {
      toast.error('Failed to create task');
      return;
    }
    const task = await res.json() as CommentTask;
    setAllTasks((prev) => [...prev, task]);
    toast.success(`Task created for ${memberNameMap[memberId] || 'team member'}`);
  };

  const toggleTaskComplete = async (commentId: string, taskId: string, completed: boolean) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${commentId}/tasks?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, completed }),
    });
    if (!res.ok) {
      toast.error('Failed to update task');
      return;
    }
    const updated = await res.json() as CommentTask;
    setAllTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
  };

  const removeTask = async (commentId: string, taskId: string) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${commentId}/tasks?company_id=${companyId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    });
    if (!res.ok) {
      toast.error('Failed to remove task');
      return;
    }
    setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast.success('Task removed');
  };

  const changePriority = async (comment: CommentWithItem, priority: FeedbackCommentPriority) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${comment.id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) {
      setAllComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, priority } : c)));
      setSelectedComment((prev) => prev?.id === comment.id ? { ...prev, priority } : prev);
    } else {
      toast.error('Failed to update priority');
    }
  };

  return {
    handleSubmitReply,
    handleSubmitGeneralComment,
    handleDeleteComment,
    handleToggleResolve,
    quickAssign,
    createTask,
    toggleTaskComplete,
    removeTask,
    changePriority,
  };
}
