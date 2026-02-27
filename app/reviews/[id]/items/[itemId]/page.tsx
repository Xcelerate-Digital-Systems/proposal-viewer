// app/reviews/[id]/items/[itemId]/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { supabase, type ReviewProject, type ReviewItem, type ReviewComment } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { usePinFeedback } from '@/hooks/usePinFeedback';
import { useCommentFilters } from '@/hooks/useCommentFilters';
import { CommentsPanel } from '@/components/reviews/comments';
import ItemContentView from '@/components/reviews/ItemContentView';
import ShareItemButton from '@/components/reviews/ShareItemButton';
import ItemSidebar from '@/components/reviews/ItemSidebar';
import { FeedbackToolbar, FeedbackModeBar } from '@/components/reviews/feedback';


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
/*  Main content                                                       */
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

  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [allProjectComments, setAllProjectComments] = useState<Pick<ReviewComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(true);

  // Type filter — read directly from the URL so it works regardless of
  // component nesting depth (useSearchParams can be unreliable inside
  // render-prop wrappers like AdminLayout).
  const getUrlType = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('type');
  }, []);
  const [typeFilter, setTypeFilter] = useState<string | null>(getUrlType);
  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  // Available types for sidebar filter tabs
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((i) => i.type)));
    return types.sort();
  }, [items]);

  const currentItem = filteredItems.find((i) => i.id === itemId) || items.find((i) => i.id === itemId) || null;
  const currentIdx = filteredItems.findIndex((i) => i.id === itemId);

  const authorName = teamMember?.name || teamMember?.email || 'Team';
  const isWebpageItem = currentItem?.type === 'webpage';

  // ── Shared hooks ──
  const {
    feedbackMode, pendingPin, setPendingPin, imageContainerRef,
    handleImageClick: baseHandleImageClick, handleCancelPin,
    changeFeedbackMode, resetFeedback,
  } = usePinFeedback();

  // Comments are already fetched per-item via Supabase, but useCommentFilters
  // still simplifies the derivation of top-level/replies/resolved/pin lists.
  // Pass itemId so the hook's internal filter is a no-op (comments already scoped).
  const {
    topLevelComments: topLevel, getReplies,
    unresolvedComments: unresolved, resolvedComments: resolved, pinComments,
  } = useCommentFilters(comments, itemId);

  // ── Fetch data ──
  const fetchProject = useCallback(async () => {
    const { data } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (!data) { router.push('/reviews'); return; }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });

    setItems(data || []);
  }, [projectId]);

  // Comments for the currently viewed item (detail view)
  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .order('created_at', { ascending: true });

    setComments(data || []);
    setLoading(false);
  }, [itemId]);

  // All comments for the project (sidebar badge counts)
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

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchComments();
    fetchAllProjectComments();
  }, [fetchProject, fetchItems, fetchComments, fetchAllProjectComments]);

  // ── Navigate between items (header arrows) ──
  const goToItem = (idx: number) => {
    if (idx >= 0 && idx < filteredItems.length) {
      const typeParam = typeFilter ? `?type=${typeFilter}` : '';
      router.push(`/reviews/${projectId}/items/${filteredItems[idx].id}${typeParam}`);
    }
  };

  // ── Sidebar: select item ──
  const handleSidebarSelect = useCallback((id: string) => {
    const typeParam = typeFilter ? `?type=${typeFilter}` : '';
    resetFeedback();
    router.push(`/reviews/${projectId}/items/${id}${typeParam}`);
  }, [projectId, typeFilter, router, resetFeedback]);

  // ── Sidebar: change type filter ──
  const handleFilterChange = useCallback((type: string | null) => {
    setTypeFilter(type);
    const newFiltered = type ? items.filter((i) => i.type === type) : items;
    const currentStillVisible = newFiltered.some((i) => i.id === itemId);
    const targetId = currentStillVisible ? itemId : newFiltered[0]?.id;

    if (targetId) {
      const typeParam = type ? `?type=${type}` : '';
      router.push(`/reviews/${projectId}/items/${targetId}${typeParam}`);
    }
  }, [items, itemId, projectId, router]);

  // ── Pin click → also open comments ──
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    baseHandleImageClick(e);
    if (feedbackMode === 'pin') setShowComments(true);
  }, [baseHandleImageClick, feedbackMode]);

  const handlePinClick = useCallback(() => {
    setShowComments(true);
  }, []);

  // ── Submit comment ──
  const submitComment = async (content: string, pinX?: number, pinY?: number, parentId?: string) => {
    if (!content.trim()) return;

    let thread_number: number | null = null;
    if (!parentId && pinX != null) {
      const maxThread = topLevel
        .filter((c) => c.thread_number != null)
        .reduce((max, c) => Math.max(max, c.thread_number || 0), 0);
      thread_number = maxThread + 1;
    }

    const insertData: Record<string, unknown> = {
      review_item_id: itemId,
      company_id: companyId,
      parent_comment_id: parentId || null,
      thread_number,
      author_name: authorName,
      author_email: teamMember?.email || null,
      author_user_id: session?.user?.id || null,
      author_type: 'team',
      content: content.trim(),
      comment_type: pinX != null ? 'pin' : 'general',
      pin_x: pinX ?? null,
      pin_y: pinY ?? null,
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
      // Also update allProjectComments so sidebar badge updates immediately
      setAllProjectComments((prev) => [...prev, data]);
      setPendingPin(null);

      // Notify webhook
      if (project?.share_token) {
        fetch('/api/review-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'review_comment_added',
            share_token: project.share_token,
            review_item_id: itemId,
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

    const res = await fetch(`/api/review-comments/${commentId}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resolved: true, resolved_by: authorName }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      // Update sidebar badge counts
      setAllProjectComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)));
      toast.success('Comment resolved');
    } else {
      toast.error('Failed to resolve');
    }
  };

  const unresolveComment = async (commentId: string) => {
    const token = session ? (await supabase.auth.getSession()).data.session?.access_token : null;
    if (!token) return;

    const res = await fetch(`/api/review-comments/${commentId}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resolved: false }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      // Update sidebar badge counts
      setAllProjectComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved: false } : c)));
      toast.info('Comment reopened');
    } else {
      toast.error('Failed to reopen');
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        {/* Left — back link */}
        <div className="flex items-center min-w-[180px]">
          <Link
            href={`/reviews/${projectId}/items${typeFilter ? `?type=${typeFilter}` : ''}`}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={14} />
            {project?.title || 'Back'}
          </Link>
        </div>

        {/* Center — item nav */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => goToItem(currentIdx - 1)}
            disabled={currentIdx <= 0}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-800 truncate max-w-[280px]">
              {currentItem?.title}
            </span>
            <span className="text-[11px] text-gray-400">
              {currentIdx + 1} of {filteredItems.length}
            </span>
          </div>
          <button
            onClick={() => goToItem(currentIdx + 1)}
            disabled={currentIdx >= filteredItems.length - 1}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 min-w-[180px] justify-end">
          {/* Open in new tab — for webpage items */}
          {isWebpageItem && currentItem?.url && (
            <a
              href={currentItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-colors"
            >
              <ExternalLink size={13} />
              Open Page
            </a>
          )}
          
          {/* Share this item */}
          {currentItem && (
            <ShareItemButton
              projectId={projectId}
              itemId={currentItem.id}
              shareToken={currentItem.share_token}
              onTokenChange={(token) => {
                setItems((prev) => prev.map((i) =>
                  i.id === currentItem.id ? { ...i, share_token: token } : i
                ));
              }}
              size="md"
            />
          )}
        </div>
      </div>

      {/* Mode bar — appears when pin mode is active */}
      <FeedbackModeBar
        mode={feedbackMode}
        onCancel={() => changeFeedbackMode('idle')}
      />

      {/* Content area — sidebar + viewer + comments */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar — item list with thumbnails & type filter */}
        <ItemSidebar
          items={items}
          filteredItems={filteredItems}
          availableTypes={typeFilter ? [] : availableTypes}
          typeFilter={typeFilter}
          onFilterChange={handleFilterChange}
          selectedItemId={itemId}
          onSelectItem={handleSidebarSelect}
          comments={allProjectComments}
          variant="admin"
          projectTitle={project?.title}
        />

        {/* Item viewer */}
        <div
          className={`flex-1 relative ${
            isWebpageItem
              ? 'overflow-auto'
              : 'overflow-auto flex items-center justify-center p-6'
          } bg-gray-50`}
        >
          <ItemContentView
            item={currentItem}
            placingPin={feedbackMode === 'pin'}
            pendingPin={pendingPin}
            pinComments={pinComments}
            onImageClick={handleImageClick}
            onPinClick={handlePinClick}
            containerRef={imageContainerRef}
            shareToken={project?.share_token || ''}
          />

          {/* Floating feedback toolbar — right edge of content area */}
          <FeedbackToolbar
            mode={feedbackMode}
            onModeChange={changeFeedbackMode}
            onToggleComments={() => setShowComments(!showComments)}
            commentsOpen={showComments}
            unresolvedCount={unresolved.length}
            hidePinTool={isWebpageItem}
            className="absolute top-4 right-4"
          />
        </div>

        {/* Comments panel */}
        {showComments && (
          <CommentsPanel
            unresolvedComments={unresolved}
            resolvedComments={resolved}
            getReplies={getReplies}
            hasComments={topLevel.length > 0}
            pendingPin={pendingPin}
            onSubmitComment={submitComment}
            onCancelPin={handleCancelPin}
            onClose={() => setShowComments(false)}
            authorName={authorName}
            onResolve={resolveComment}
            onUnresolve={unresolveComment}
            className="w-[340px] shrink-0 border-l border-gray-200 bg-white flex flex-col"
          />
        )}
      </div>
    </div>
  );
}