'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackCommentReaction } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import FeedbackDetailView from '@/components/feedback/FeedbackDetailView';


export default function ReviewItemViewerPage({
  params,
}: {
  params: { id: string; itemId: string };
}) {
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <ItemViewerGate
          isSuperAdmin={auth.isSuperAdmin}
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
  isSuperAdmin?: boolean;
  projectId: string;
  itemId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { name?: string; email?: string } | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!props.isSuperAdmin) router.replace('/dashboard');
  }, [props.isSuperAdmin, router]);

  if (!props.isSuperAdmin) return null;

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
  teamMember: { name?: string; email?: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [allProjectComments, setAllProjectComments] = useState<Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[]>([]);
  const [reactions, setReactions] = useState<FeedbackCommentReaction[]>([]);
  const [loading, setLoading] = useState(true);

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

    if (!data) { router.push('/feedback'); return; }
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
      router.replace(`/feedback/${projectId}/items`);
      return;
    }
    setItems(all.filter((i) => i.type !== 'webpage'));
  }, [projectId, itemId, router]);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .order('created_at', { ascending: true });

    setComments(data || []);
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
      .select('id, review_item_id, parent_comment_id, resolved')
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

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchComments();
    fetchAllProjectComments();
    fetchReactions();
  }, [fetchProject, fetchItems, fetchComments, fetchAllProjectComments, fetchReactions]);

  // ── Submit comment ──
  const submitComment = async (reviewItemId: string, content: string, pinX?: number, pinY?: number, parentId?: string, annotationData?: unknown, screenshotUrl?: string, highlightData?: { text: string; start: number; end: number; elementPath: string }) => {
    if (!content.trim()) return;

    const currentItem = items.find((i) => i.id === reviewItemId) || null;

    let thread_number: number | null = null;
    if (!parentId && pinX != null) {
      const existingTopLevel = comments.filter((c) => !c.parent_comment_id);
      const maxThread = existingTopLevel
        .filter((c) => c.thread_number != null)
        .reduce((max, c) => Math.max(max, c.thread_number || 0), 0);
      thread_number = maxThread + 1;
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
      comment_type: highlightData ? 'text_highlight' : annotationData ? (annotationData as Record<string, unknown>).type as string : (pinX != null ? 'pin' : 'general'),
      pin_x: pinX ?? null,
      pin_y: pinY ?? null,
      annotation_data: annotationData || null,
      screenshot_url: screenshotUrl || null,
      highlight_start: highlightData?.start ?? null,
      highlight_end: highlightData?.end ?? null,
      highlight_text: highlightData?.text ?? null,
      highlight_element_path: highlightData?.elementPath ?? null,
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

      // Notify webhook
      if (project?.share_token) {
        fetch('/api/review-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'review_comment_added',
            share_token: project.share_token,
            review_item_id: reviewItemId,
            comment_author: authorName,
            comment_content: content.trim(),
            item_title: currentItem?.title,
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

  // ── Navigation callbacks for FeedbackDetailView ──
  const handleItemChange = useCallback((newItemId: string, type: string | null) => {
    const typeParam = type ? `?type=${type}` : '';
    router.push(`/feedback/${projectId}/items/${newItemId}${typeParam}`);
  }, [projectId, router]);

  const handleFilterChange = useCallback((type: string | null, firstItemId: string | null) => {
    if (firstItemId) {
      const typeParam = type ? `?type=${type}` : '';
      router.push(`/feedback/${projectId}/items/${firstItemId}${typeParam}`);
    }
  }, [projectId, router]);

  // ── Loading ──
  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <FeedbackDetailView
      mode="admin"
      project={project}
      items={items}
      comments={comments}
      allProjectComments={allProjectComments}
      initialItemId={itemId}
      initialTypeFilter={typeFilter}
      authorName={authorName}
      onSubmitComment={submitComment}
      onResolveComment={resolveComment}
      onUnresolveComment={unresolveComment}
      onEditComment={editComment}
      onDeleteComment={deleteComment}
      onItemChange={handleItemChange}
      onFilterChange={handleFilterChange}
      shareToken={project.share_token || ''}
      companyId={companyId}
      backAction={{
        label: project.title || 'Back',
        onClick: () => router.push(`/feedback/${projectId}/items${typeFilter ? `?type=${typeFilter}` : ''}`),
      }}
    />
  );
}