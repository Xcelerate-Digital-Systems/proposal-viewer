import { useCallback } from 'react';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackCommentReaction, type FeedbackStatus, type FeedbackCommentAttachment } from '@/lib/supabase';
import type { FeedbackCommentPriority, CommentTask, CommentTaskAttachment } from '@/lib/types/feedback';

interface UseItemViewerActionsArgs {
  projectId: string;
  itemId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { id?: string; name?: string; email?: string; avatar_path?: string | null } | null;
  project: FeedbackProject | null;
  items: FeedbackItem[];
  comments: FeedbackComment[];
  allProjectComments: Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved' | 'thread_number'>[];
  activeVersionId: string | null;
  authorName: string;
  toast: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void };
  setComments: React.Dispatch<React.SetStateAction<FeedbackComment[]>>;
  setAllProjectComments: React.Dispatch<React.SetStateAction<Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved' | 'thread_number'>[]>>;
  setItems: React.Dispatch<React.SetStateAction<FeedbackItem[]>>;
  setReactions: React.Dispatch<React.SetStateAction<FeedbackCommentReaction[]>>;
}

export function useItemViewerActions({
  projectId,
  itemId,
  companyId,
  session,
  teamMember,
  project,
  items,
  comments,
  allProjectComments,
  activeVersionId,
  authorName,
  toast,
  setComments,
  setAllProjectComments,
  setItems,
  setReactions,
}: UseItemViewerActionsArgs) {

  // ── Submit comment ──
  const submitComment = async (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }, priority?: FeedbackCommentPriority, attachments?: FeedbackCommentAttachment[], videoUrl?: string | null) => {
    if (!content.trim()) return;

    const currentItem = items.find((i) => i.id === reviewItemId) || null;

    let thread_number: number | null = null;
    const isNumberedAnnotation = pinX != null || highlightData != null;
    if (!parentId && isNumberedAnnotation) {
      // Compute next thread number from all project comments (campaign-wide)
      const allNums = [...allProjectComments, ...comments]
        .filter((c) => c.thread_number != null)
        .map((c) => c.thread_number as number);
      const uniqueMax = allNums.length > 0 ? Math.max(...allNums) : 0;
      thread_number = uniqueMax + 1;
    }

    // Extract ad_copy_variation_id from the view string if this is a
    // variation-scoped comment (variant-<uuid>). Only set for real UUIDs
    // from ad_copy_variations — legacy 8-char nanoid IDs stay NULL so the
    // FK constraint isn't violated on existing ads.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let adCopyVariationId: string | null = null;
    if (annotationData && typeof annotationData === 'object') {
      const view = (annotationData as Record<string, unknown>).view;
      if (typeof view === 'string' && view.startsWith('variant-')) {
        const candidateId = view.slice('variant-'.length);
        if (UUID_RE.test(candidateId)) {
          adCopyVariationId = candidateId;
        }
      }
    }

    const insertData: Record<string, unknown> = {
      review_item_id: reviewItemId,
      company_id: companyId,
      parent_comment_id: parentId || null,
      thread_number,
      author_name: authorName,
      author_email: teamMember?.email || null,
      author_user_id: session?.user?.id || null,
      author_type: 'team',
      content: content.trim(),
      comment_type: highlightData
        ? 'text_highlight'
        : (annotationData && typeof (annotationData as Record<string, unknown>).type === 'string')
          ? (annotationData as Record<string, unknown>).type as string
          : (pinX != null ? 'pin' : 'general'),
      pin_x: pinX ?? null,
      pin_y: pinY ?? null,
      annotation_data: annotationData || null,
      screenshot_url: screenshotUrl || null,
      highlight_start: highlightData?.start ?? null,
      highlight_end: highlightData?.end ?? null,
      highlight_text: highlightData?.text ?? null,
      highlight_element_path: highlightData?.elementPath ?? null,
      priority: priority ?? 'none',
      attachments: attachments || [],
      video_url: videoUrl ?? null,
      ad_copy_variation_id: adCopyVariationId,
      // Pin the comment to whichever version the reviewer is currently looking
      // at. For replies, inherit the parent's version so threads stay coherent.
      version_id: parentId
        ? (comments.find((c) => c.id === parentId)?.version_id ?? null)
        : (reviewItemId === currentItem?.id ? activeVersionId : null),
    };

    const { data, error } = await supabase
      .from('review_comments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast.error(error.message || 'Could not post comment. Check your connection and try again.');
    } else if (data) {
      setComments((prev) => [...prev, data]);
      setAllProjectComments((prev) => [...prev, data]);

      // Notify webhook + participants
      if (project?.share_token) {
        fetch('/api/review-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'review_comment_added',
            share_token: project.share_token,
            review_item_id: reviewItemId,
            review_comment_id: data.id,
            comment_author: authorName,
            comment_author_email: teamMember?.email || null,
            author_user_id: session?.user?.id || null,
            comment_content: content.trim(),
            item_title: currentItem?.title,
            parent_comment_id: parentId || null,
            author_type: 'team',
          }),
        }).catch(() => {});
      }
    }
  };

  // ── Resolve / unresolve ──
  const resolveComment = async (commentId: string) => {
    const token = session ? (await supabase.auth.getSession()).data.session?.access_token : null;
    if (!token) return;

    const res = await fetch(`/api/review-comments/${commentId}/resolve?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resolved: true, resolved_by: authorName }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setAllProjectComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)));
      toast.success('Comment resolved');
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Could not resolve comment');
    }
  };

  const unresolveComment = async (commentId: string) => {
    const token = session ? (await supabase.auth.getSession()).data.session?.access_token : null;
    if (!token) return;

    const res = await fetch(`/api/review-comments/${commentId}/resolve?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resolved: false }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setAllProjectComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved: false } : c)));
      toast.info('Comment reopened');
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Could not reopen comment');
    }
  };

  // ── Edit / delete ──
  const editComment = async (commentId: string, content: string) => {
    const token = session ? (await supabase.auth.getSession()).data.session?.access_token : null;
    if (!token) return;

    const res = await fetch(`/api/review-comments/${commentId}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      toast.success('Comment updated');
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Could not update comment');
    }
  };

  const deleteComment = async (commentId: string) => {
    const token = session ? (await supabase.auth.getSession()).data.session?.access_token : null;
    if (!token) return;

    const res = await fetch(`/api/review-comments/${commentId}?company_id=${companyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId)
      );
      setAllProjectComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId)
      );
      toast.success('Comment deleted');
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Could not delete comment');
    }
  };

  // ── Task callbacks (internal-only) ──
  const createTask = async (commentId: string, memberId: string, instructions: string, attachments: CommentTaskAttachment[]) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${commentId}/tasks?company_id=${companyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: memberId, instructions: instructions || undefined, attachments }),
    });
    if (res.ok) {
      const task: CommentTask = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, tasks: [...(c.tasks ?? []), task] } : c
        )
      );
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Could not create task');
    }
  };

  const quickAssign = async (commentId: string, memberId: string, instructions: string) => {
    await createTask(commentId, memberId, instructions, []);
  };

  const toggleTaskComplete = async (commentId: string, taskId: string, completed: boolean) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${commentId}/tasks?company_id=${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, completed }),
    });
    if (res.ok) {
      const updated: CommentTask = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, tasks: (c.tasks ?? []).map((t) => (t.id === taskId ? updated : t)) }
            : c
        )
      );
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Could not update task');
    }
  };

  const removeTask = async (commentId: string, taskId: string) => {
    const { authFetch } = await import('@/lib/auth-fetch');
    const res = await authFetch(`/api/review-comments/${commentId}/tasks?company_id=${companyId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    });
    if (res.ok) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, tasks: (c.tasks ?? []).filter((t) => t.id !== taskId) }
            : c
        )
      );
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Could not remove task');
    }
  };

  // ── Toggle reaction ──
  const toggleReaction = useCallback(async (commentId: string, emoji: string) => {
    const res = await fetch(`/api/review-comments/${commentId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emoji,
        author_name: authorName,
        author_user_id: session?.user?.id || null,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.action === 'added') {
        setReactions((prev) => [...prev, result.reaction]);
      } else {
        setReactions((prev) => prev.filter((r) => r.id !== result.id));
      }
    }
  }, [authorName, session?.user?.id, setReactions]);

  // Admin can update item status from the same dropdown the client sees.
  const updateItemStatus = useCallback(async (itemIdToUpdate: string, status: FeedbackStatus) => {
    const previous = items.find((i) => i.id === itemIdToUpdate)?.status;
    setItems((prev) => prev.map((i) => (i.id === itemIdToUpdate ? { ...i, status } : i)));
    const { error } = await supabase
      .from('review_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', itemIdToUpdate);
    if (error) {
      toast.error(error.message || 'Could not update status. Check your connection and try again.');
      if (previous) {
        setItems((prev) => prev.map((i) => (i.id === itemIdToUpdate ? { ...i, status: previous } : i)));
      }
    }
  }, [items, toast, setItems]);

  return {
    submitComment,
    resolveComment,
    unresolveComment,
    editComment,
    deleteComment,
    quickAssign,
    createTask,
    toggleTaskComplete,
    removeTask,
    toggleReaction,
    updateItemStatus,
  };
}
