'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackCommentReaction, type FeedbackStatus } from '@/lib/supabase';
import type { FeedbackCommentPriority, CommentTask, CommentTaskAttachment } from '@/lib/types/feedback';
import TaskModal from '@/components/admin/feedback/feedback-list/TaskModal';
import TaskDetailModal from '@/components/admin/feedback/feedback-list/TaskDetailModal';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import FeedbackDetailView from '@/components/feedback/FeedbackDetailView';
import AddVersionModal from '@/components/admin/feedback/AddVersionModal';
import { useItemVersions } from '@/hooks/useItemVersions';
import { applyVersion, getActiveVersion } from '@/lib/feedback/versions';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';


export default function ReviewItemViewerPage(
  props: {
    params: Promise<{ id: string; itemId: string }>;
  }
) {
  const params = use(props.params);
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <ItemViewerGate
          accountType={auth.accountType}
          projectId={params.id}
          itemId={params.itemId}
          companyId={auth.companyId!}
          session={auth.session}
          teamMember={auth.teamMember}
        />
      )}
    </AdminLayout>
  );
}

function ItemViewerGate(props: {
  accountType?: 'agency' | 'client';
  projectId: string;
  itemId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { id?: string; name?: string; email?: string } | null;
}) {
  const router = useRouter();
  const allowed = props.accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;

  return <ItemViewerContent {...props} />;
}

/* ================================================================== */
/*  Main content — data fetching + callbacks, delegates UI to shared   */
/* ================================================================== */

function ItemViewerContent({
  projectId,
  itemId,
  companyId,
  session,
  teamMember,
}: {
  isSuperAdmin?: boolean;
  projectId: string;
  itemId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { id?: string; name?: string; email?: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null | undefined>(undefined);
  const [allProjectComments, setAllProjectComments] = useState<Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved' | 'thread_number'>[]>([]);
  const [reactions, setReactions] = useState<FeedbackCommentReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [reviewMode, setReviewMode] = useState<'comment' | 'browse'>('comment');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [taskingCommentId, setTaskingCommentId] = useState<string | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<{ task: CommentTask; comment: FeedbackComment } | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [memberNameMap, setMemberNameMap] = useState<Record<string, string>>({});

  const authorName = teamMember?.name || teamMember?.email || 'Team';

  // Type filter — read from URL
  const getUrlType = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('type');
  }, []);
  const [typeFilter] = useState<string | null>(getUrlType);

  // ── Fetch data ──
  const fetchProject = useCallback(async () => {
    const { data } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (!data) { router.push('/campaigns'); return; }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });

    // Webpage items live on their own integrated viewer (widget on the real URL),
    // so they must never appear in this feedback detail view — neither in the
    // sidebar nor as the current item. If the requested itemId is a webpage,
    // send the user back to the items listing.
    const all = data || [];
    const currentIsWebpage = all.find((i) => i.id === itemId)?.type === 'webpage';
    if (currentIsWebpage) {
      router.replace(`/campaigns/${projectId}/assets`);
      return;
    }
    setItems(all.filter((i) => i.type !== 'webpage'));
  }, [projectId, itemId, router]);

  const fetchComments = useCallback(async () => {
    // Fetch direct comments on this item
    const { data: directComments } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .order('created_at', { ascending: true });

    let allComments = directComments || [];

    // For Meta Ads: also fetch variation-scoped comments from sibling items.
    // These are comments where ad_copy_variation_id matches one of this
    // item's linked variations but review_item_id is a different item.
    const { data: links } = await supabase
      .from('review_item_ad_variations')
      .select('ad_copy_variation_id')
      .eq('review_item_id', itemId);

    if (links && links.length > 0) {
      const varIds = links.map((l) => l.ad_copy_variation_id);
      const { data: varComments } = await supabase
        .from('review_comments')
        .select('*')
        .in('ad_copy_variation_id', varIds)
        .neq('review_item_id', itemId)
        .order('created_at', { ascending: true });

      if (varComments && varComments.length > 0) {
        // Remap review_item_id so useCommentFilters includes them
        const remapped = varComments.map((c) => ({ ...c, review_item_id: itemId }));
        allComments = [...allComments, ...remapped].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
    }

    setComments(allComments);
    setLoading(false);
  }, [itemId]);

  const fetchAllProjectComments = useCallback(async () => {
    const { data: projectItems } = await supabase
      .from('review_items')
      .select('id')
      .eq('review_project_id', projectId);

    if (!projectItems?.length) return;

    const itemIds = projectItems.map((i) => i.id);
    const { data } = await supabase
      .from('review_comments')
      .select('id, review_item_id, parent_comment_id, resolved, thread_number')
      .in('review_item_id', itemIds);

    setAllProjectComments(data || []);
  }, [projectId]);

  const fetchReactions = useCallback(async () => {
    // Fetch reactions for all comments on this item
    const { data: itemComments } = await supabase
      .from('review_comments')
      .select('id')
      .eq('review_item_id', itemId);

    if (!itemComments?.length) return;

    const commentIds = itemComments.map((c) => c.id);
    const { data } = await supabase
      .from('review_comment_reactions')
      .select('*')
      .in('review_comment_id', commentIds)
      .order('created_at', { ascending: true });

    setReactions(data || []);
  }, [itemId]);

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
  }, [authorName, session?.user?.id]);

  const fetchBranding = useCallback(async () => {
    if (!companyId) {
      setBrandingLoaded(true);
      return;
    }
    try {
      const res = await fetch(`/api/company/branding?company_id=${companyId}`);
      if (res.ok) setBranding(await res.json());
    } catch {
      // Fall back to DEFAULT_BRANDING — header just stays neutral.
    } finally {
      setBrandingLoaded(true);
    }
  }, [companyId]);

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchComments();
    fetchAllProjectComments();
    fetchReactions();
    fetchBranding();
  }, [fetchProject, fetchItems, fetchComments, fetchAllProjectComments, fetchReactions, fetchBranding]);

  // Fetch team members for task modal
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name, email')
        .eq('company_id', companyId);
      if (!cancelled && data) {
        setTeamMembers(data);
        const map: Record<string, string> = {};
        for (const m of data) map[m.id] = m.name;
        setMemberNameMap(map);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Fetch tasks for all loaded comments
  useEffect(() => {
    if (comments.length === 0) return;
    let cancelled = false;
    (async () => {
      const commentIds = comments.filter((c) => !c.parent_comment_id).map((c) => c.id);
      const { data } = await supabase
        .from('comment_tasks')
        .select('*')
        .in('comment_id', commentIds);
      if (!cancelled && data) {
        const byComment = new Map<string, CommentTask[]>();
        for (const t of data) {
          const arr = byComment.get(t.comment_id) || [];
          arr.push(t as CommentTask);
          byComment.set(t.comment_id, arr);
        }
        setComments((prev) =>
          prev.map((c) => ({ ...c, tasks: byComment.get(c.id) ?? [] }))
        );
      }
    })();
    return () => { cancelled = true; };
  }, [comments.length]);

  // ── Current item + its versions ──
  const currentItem = items.find((i) => i.id === itemId) || null;
  const supportsVersions = currentItem && currentItem.type !== 'webpage';
  const {
    versions, activeVersionId, creating: creatingVersion,
    setActiveVersion, createVersion, updateVersion, uploadAsset,
  } = useItemVersions({
    item: supportsVersions ? currentItem : null,
    companyId,
    userId: session?.user?.id ?? null,
  });

  // Version-merged item: overlays the active version's assets onto the raw
  // item so AddVersionModal seeds from the CURRENT version's copy, not v1.
  const mergedItem = useMemo(() => {
    if (!currentItem || versions.length === 0) return currentItem;
    const active = getActiveVersion(versions, activeVersionId);
    return applyVersion(currentItem, active);
  }, [currentItem, versions, activeVersionId]);

  // ── Submit comment ──
  const submitComment = async (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }, priority?: FeedbackCommentPriority, attachments?: import('@/lib/supabase').FeedbackCommentAttachment[], videoUrl?: string | null) => {
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
      toast.error('Failed to post comment');
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
      toast.error(body?.error || 'Failed to resolve');
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
      toast.error(body?.error || 'Failed to reopen');
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
      toast.error(body?.error || 'Failed to update comment');
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
      toast.error(body?.error || 'Failed to delete comment');
    }
  };

  // ── Task callbacks (internal-only) ──
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
    if (res.ok) {
      const task: CommentTask = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, tasks: [...(c.tasks ?? []), task] } : c
        )
      );
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error || 'Failed to create task');
    }
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
      toast.error(body?.error || 'Failed to update task');
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
      toast.error(body?.error || 'Failed to remove task');
    }
  };

  // ── Navigation callbacks for FeedbackDetailView ──
  const handleItemChange = useCallback((newItemId: string, type: string | null) => {
    const typeParam = type ? `?type=${type}` : '';
    router.push(`/campaigns/${projectId}/assets/${newItemId}${typeParam}`);
  }, [projectId, router]);

  const handleFilterChange = useCallback((type: string | null, firstItemId: string | null) => {
    if (firstItemId) {
      const typeParam = type ? `?type=${type}` : '';
      router.push(`/campaigns/${projectId}/assets/${firstItemId}${typeParam}`);
    }
  }, [projectId, router]);

  // Admin can update item status from the same dropdown the client sees.
  const updateItemStatus = useCallback(async (itemIdToUpdate: string, status: FeedbackStatus) => {
    const previous = items.find((i) => i.id === itemIdToUpdate)?.status;
    setItems((prev) => prev.map((i) => (i.id === itemIdToUpdate ? { ...i, status } : i)));
    const { error } = await supabase
      .from('review_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', itemIdToUpdate);
    if (error) {
      toast.error('Failed to update status');
      if (previous) {
        setItems((prev) => prev.map((i) => (i.id === itemIdToUpdate ? { ...i, status: previous } : i)));
      }
    }
  }, [items, toast]);

  // ── Loading ──
  // Wait for branding before painting anything so we don't flash the default
  // teal accent before the agency's brand color settles in.
  if (!brandingLoaded || loading || !project) {
    const accent = branding.accent_color || '#017C87';
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: `${accent}33`, borderTopColor: accent }}
        />
      </div>
    );
  }

  return (
    <>
      <FeedbackDetailView
        mode="admin"
        project={project}
        items={items}
        comments={comments}
        branding={branding}
        allProjectComments={allProjectComments}
        initialItemId={itemId}
        initialTypeFilter={typeFilter}
        authorName={authorName}
        onSubmitComment={submitComment}
        onResolveComment={resolveComment}
        onUnresolveComment={unresolveComment}
        onEditComment={editComment}
        onDeleteComment={deleteComment}
        onOpenTasks={(cId) => setTaskingCommentId(cId)}
        onQuickAssign={quickAssign}
        onToggleTaskComplete={toggleTaskComplete}
        onRemoveTask={removeTask}
        currentMemberId={teamMember?.id ?? null}
        onOpenTaskDetail={(commentId, task) => {
          const c = comments.find((x) => x.id === commentId);
          if (c) setSelectedTaskDetail({ task, comment: c });
        }}
        onItemChange={handleItemChange}
        onFilterChange={handleFilterChange}
        shareToken={project.share_token || ''}
        companyId={companyId}
        versions={supportsVersions ? versions : undefined}
        activeVersionId={activeVersionId}
        onVersionChange={supportsVersions ? setActiveVersion : undefined}
        onAddVersion={supportsVersions ? () => setShowAddVersion(true) : undefined}
        onEditVersion={
          supportsVersions
            ? (versionId) => setEditingVersionId(versionId)
            : undefined
        }
        backAction={{
          label: project.title || 'Back',
          onClick: () => router.push(`/campaigns/${projectId}/assets${typeFilter ? `?type=${typeFilter}` : ''}`),
        }}
        onUpdateItemStatus={updateItemStatus}
        browseMode={reviewMode === 'browse'}
        reviewMode={reviewMode}
        onReviewModeChange={setReviewMode}
        reviewerName={authorName}
        reviewerEmail={teamMember?.email || ''}
        reviewSubmitted={reviewSubmitted}
        onReviewSubmitted={() => setReviewSubmitted(true)}
      />

      {showAddVersion && mergedItem && (
        <AddVersionModal
          item={mergedItem}
          nextVersionNumber={versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1}
          creating={creatingVersion}
          onClose={() => setShowAddVersion(false)}
          onSubmit={createVersion}
          onUploadAsset={uploadAsset}
        />
      )}

      {taskingCommentId && (() => {
        const c = comments.find((x) => x.id === taskingCommentId);
        if (!c) return null;
        return (
          <TaskModal
            commentId={c.id}
            commentContent={c.content}
            companyId={companyId}
            currentMemberId={teamMember?.id ?? null}
            existingTasks={c.tasks ?? []}
            teamMembers={teamMembers}
            memberNameMap={memberNameMap}
            onCreateTask={createTask}
            onToggleComplete={toggleTaskComplete}
            onRemoveTask={removeTask}
            onClose={() => setTaskingCommentId(null)}
          />
        );
      })()}

      {selectedTaskDetail && (() => {
        const c = selectedTaskDetail.comment;
        return (
          <TaskDetailModal
            task={selectedTaskDetail.task}
            commentContent={c.content || ''}
            commentAuthorName={c.author_name}
            commentCreatedAt={c.created_at}
            commentScreenshotUrl={c.screenshot_url}
            commentVideoUrl={c.video_url}
            commentThreadNumber={c.thread_number}
            itemTitle={currentItem?.title}
            itemType={currentItem?.type}
            projectId={projectId}
            reviewItemId={currentItem?.id}
            companyId={companyId}
            currentMemberId={teamMember?.id ?? null}
            memberNameMap={memberNameMap}
            teamMembers={teamMembers}
            existingTasks={c.tasks ?? []}
            onToggleComplete={toggleTaskComplete}
            onRemoveTask={removeTask}
            onCreateTask={createTask}
            onClose={() => setSelectedTaskDetail(null)}
          />
        );
      })()}

      {editingVersionId !== undefined && currentItem && (() => {
        const editing = versions.find((v) => (v.id ?? null) === editingVersionId);
        if (!editing) {
          setEditingVersionId(undefined);
          return null;
        }
        return (
          <AddVersionModal
            item={currentItem}
            nextVersionNumber={editing.versionNumber}
            creating={false}
            editingVersion={editing}
            onUpdate={updateVersion}
            onSubmit={createVersion}
            onClose={() => setEditingVersionId(undefined)}
            onUploadAsset={uploadAsset}
          />
        );
      })()}
    </>
  );
}