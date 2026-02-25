// app/reviews/[id]/items/[itemId]/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { supabase, type ReviewProject, type ReviewItem, type ReviewComment } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { CommentsPanel } from '@/components/reviews/comments';
import ItemContentView, { type WebpagePinPlacement } from '@/components/reviews/ItemContentView';

export default function ReviewItemViewerPage({
  params,
}: {
  params: { id: string; itemId: string };
}) {
  return (
    <AdminLayout>
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
  const searchParams = useSearchParams();
  const toast = useToast();

  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(true);

  // Pin placement
  const [placingPin, setPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  // Webpage pin element path — stored separately so we can include it on submit
  const pendingElementPathRef = useRef<string>('');

  // Type filter from URL
  const typeFilter = searchParams.get('type');
  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  const currentItem = filteredItems.find((i) => i.id === itemId) || items.find((i) => i.id === itemId) || null;
  const currentIdx = filteredItems.findIndex((i) => i.id === itemId);

  const authorName = teamMember?.name || teamMember?.email || 'Team';
  const isWebpageItem = currentItem?.type === 'webpage';

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

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .order('created_at', { ascending: true });

    setComments(data || []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchComments();
  }, [fetchProject, fetchItems, fetchComments]);

  // ── Comment helpers ──
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId);
  const unresolved = topLevel.filter((c) => !c.resolved);
  const resolved = topLevel.filter((c) => c.resolved);
  const pinComments = topLevel.filter((c) => c.comment_type === 'pin' && c.pin_x != null && c.pin_y != null);

  // ── Navigate between items ──
  const goToItem = (idx: number) => {
    if (idx >= 0 && idx < filteredItems.length) {
      const typeParam = typeFilter ? `?type=${typeFilter}` : '';
      router.push(`/reviews/${projectId}/items/${filteredItems[idx].id}${typeParam}`);
    }
  };

  // ── Pin placement — image/ad items ──
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    pendingElementPathRef.current = '';
    setPlacingPin(false);
    setShowComments(true);
  };

  // ── Pin placement — webpage items (from iframe postMessage) ──
  const handleWebpagePinPlaced = useCallback((placement: WebpagePinPlacement) => {
    setPendingPin({ x: placement.pin_x, y: placement.pin_y });
    pendingElementPathRef.current = placement.element_path;
    setPlacingPin(false);
    setShowComments(true);
  }, []);

  // ── Pin click handler (supports commentId from iframe) ──
  const handlePinClick = useCallback((commentId?: string) => {
    setShowComments(true);
    // If commentId provided, could scroll to that comment in panel
    // For now just open the panel
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

    // Include element path for webpage pin comments
    if (pinX != null && pendingElementPathRef.current) {
      insertData.pin_element_path = pendingElementPathRef.current;
    }

    const { data, error } = await supabase
      .from('review_comments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast.error('Failed to post comment');
    } else if (data) {
      setComments((prev) => [...prev, data]);
      setPendingPin(null);
      pendingElementPathRef.current = '';

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
      toast.info('Comment reopened');
    } else {
      toast.error('Failed to reopen');
    }
  };

  // ── Cancel pin (also tell iframe to cancel) ──
  const handleCancelPin = useCallback(() => {
    setPendingPin(null);
    pendingElementPathRef.current = '';
  }, []);

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/reviews/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <ArrowLeft size={14} />
            {project?.title || 'Back'}
          </Link>

          <span className="text-gray-200">·</span>

          {/* Item navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToItem(currentIdx - 1)}
              disabled={currentIdx <= 0}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
              {currentItem?.title}
            </span>
            <span className="text-xs text-gray-400 shrink-0">
              {currentIdx + 1}/{filteredItems.length}
            </span>
            <button
              onClick={() => goToItem(currentIdx + 1)}
              disabled={currentIdx >= filteredItems.length - 1}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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

          {/* Place pin button */}
          <button
            onClick={() => { setPlacingPin(!placingPin); setPendingPin(null); pendingElementPathRef.current = ''; }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              placingPin
                ? 'bg-[#017C87]/10 text-[#017C87] border-[#017C87]'
                : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <MapPin size={13} />
            {placingPin ? 'Click to place pin' : 'Add Pin'}
          </button>

          {/* Toggle comments */}
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showComments
                ? 'bg-[#017C87]/10 text-[#017C87] border-[#017C87]'
                : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <MessageSquare size={13} />
            Comments
            {unresolved.length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-[#017C87] text-white px-1.5 py-0.5 rounded-full">
                {unresolved.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0">
        {/* Item viewer — full size for webpage, centered for images/ads */}
        <div
          className={`flex-1 ${
            isWebpageItem
              ? 'overflow-hidden'
              : 'overflow-auto flex items-center justify-center p-6'
          } bg-gray-50`}
        >
          <ItemContentView
            item={currentItem}
            placingPin={placingPin}
            pendingPin={pendingPin}
            pinComments={pinComments}
            onImageClick={handleImageClick}
            onPinClick={handlePinClick}
            shareToken={project?.share_token || ''}
            onWebpagePinPlaced={handleWebpagePinPlaced}
            allComments={comments}
          />
        </div>

        {/* Comments panel */}
        {showComments && (
          <CommentsPanel
            variant="admin"
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