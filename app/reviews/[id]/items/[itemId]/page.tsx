// app/reviews/[id]/items/[itemId]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, MessageSquare,
  CheckCircle2, CornerDownRight, Send, X, ChevronDown,
  RotateCcw, Image as ImageIcon,
} from 'lucide-react';
import { supabase, type ReviewProject, type ReviewItem, type ReviewComment } from '@/lib/supabase';
import AdMockupPreview, { type AdPlatform } from '@/components/admin/reviews/AdMockupPreview';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';

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
/*  Main viewer content                                                */
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
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(true);

  // Pin placement
  const [placingPin, setPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);

  const currentItem = items.find((i) => i.id === itemId) || null;
  const currentIdx = items.findIndex((i) => i.id === itemId);

  const authorName = teamMember?.name || teamMember?.email || 'Team';

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
    if (idx >= 0 && idx < items.length) {
      router.push(`/reviews/${projectId}/items/${items[idx].id}`);
    }
  };

  // ── Pin placement ──
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setPlacingPin(false);
    setShowComments(true);
  };

  // ── Submit comment ──
  const submitComment = async (content: string, pinX?: number, pinY?: number, parentId?: string) => {
    if (!content.trim()) return;

    // Determine thread_number for new top-level pin comments
    let thread_number: number | null = null;
    if (!parentId && pinX != null) {
      const maxThread = topLevel
        .filter((c) => c.thread_number != null)
        .reduce((max, c) => Math.max(max, c.thread_number || 0), 0);
      thread_number = maxThread + 1;
    }

    const { data, error } = await supabase
      .from('review_comments')
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to post comment');
    } else if (data) {
      setComments((prev) => [...prev, data]);
      setPendingPin(null);

      // Fire notification (team commenting → notify client)
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

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  const imageUrl = currentItem?.image_url || currentItem?.screenshot_url || currentItem?.ad_creative_url;
  const isAdItem = currentItem?.type === 'ad' && currentItem?.ad_creative_url;

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
              {currentIdx + 1}/{items.length}
            </span>
            <button
              onClick={() => goToItem(currentIdx + 1)}
              disabled={currentIdx >= items.length - 1}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Place pin button */}
          <button
            onClick={() => { setPlacingPin(!placingPin); setPendingPin(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              placingPin
                ? 'bg-[#017C87]/10 text-[#017C87] border-[#017C87]'
                : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <MapPin size={13} />
            {placingPin ? 'Click image to place' : 'Add Pin'}
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
        {/* Item viewer */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-gray-50">
          {(imageUrl || isAdItem) ? (
            <div
              className="relative max-w-full max-h-full"
              style={{ cursor: placingPin ? 'crosshair' : 'default' }}
              onClick={handleImageClick}
            >
              {/* Ad mockup rendering */}
              {isAdItem && (
                <div className="select-none">
                  <AdMockupPreview
                    creativeUrl={currentItem!.ad_creative_url!}
                    headline={currentItem!.ad_headline || ''}
                    primaryText={currentItem!.ad_copy || ''}
                    ctaText={currentItem!.ad_cta || 'Learn More'}
                    platform={(currentItem!.ad_platform as AdPlatform) || 'facebook_feed'}
                    pageName="Your Brand"
                    showPlatformToggle
                  />
                </div>
              )}

              {/* Image rendering (non-ad items) */}
              {!isAdItem && imageUrl && (
                <img
                  src={imageUrl}
                  alt={currentItem?.title || ''}
                  className="max-w-full max-h-[calc(100dvh-120px)] object-contain rounded-lg shadow-sm select-none"
                  draggable={false}
                />
              )}

              {/* Pin markers */}
              {pinComments.map((c) => (
                <button
                  key={c.id}
                  className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg z-10 transition-transform hover:scale-110 ${
                    c.resolved
                      ? 'bg-gray-400 opacity-50'
                      : 'bg-[#017C87] text-white'
                  }`}
                  style={{ left: `${c.pin_x}%`, top: `${c.pin_y}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(true);
                  }}
                  title={`#${c.thread_number}: ${c.content.slice(0, 50)}`}
                >
                  {c.thread_number || '•'}
                </button>
              ))}

              {/* Pending pin */}
              {pendingPin && (
                <div
                  className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg animate-pulse z-10 bg-[#017C87] text-white"
                  style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
                >
                  +
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <ImageIcon size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No preview available</p>
            </div>
          )}
        </div>

        {/* Comments panel */}
        {showComments && (
          <div className="w-[340px] shrink-0 border-l border-gray-200 bg-white flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <div>
                <span className="text-sm font-semibold text-gray-900">Comments</span>
                {unresolved.length > 0 && (
                  <span className="ml-1.5 text-xs text-gray-400">
                    ({unresolved.length} open)
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowComments(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Threads */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Pending pin form */}
              {pendingPin && (
                <PendingPinForm
                  authorName={authorName}
                  onSubmit={async (content) => {
                    await submitComment(content, pendingPin.x, pendingPin.y);
                  }}
                  onCancel={() => setPendingPin(null)}
                />
              )}

              {/* Unresolved */}
              {unresolved.map((c) => (
                <AdminCommentThread
                  key={c.id}
                  comment={c}
                  replies={getReplies(c.id)}
                  authorName={authorName}
                  onReply={(content) => submitComment(content, undefined, undefined, c.id)}
                  onResolve={() => resolveComment(c.id)}
                  onUnresolve={() => unresolveComment(c.id)}
                />
              ))}

              {/* Resolved */}
              {resolved.length > 0 && (
                <ResolvedSection
                  comments={resolved}
                  getReplies={getReplies}
                  onUnresolve={unresolveComment}
                />
              )}

              {topLevel.length === 0 && !pendingPin && (
                <div className="text-center py-8">
                  <MapPin size={24} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-xs text-gray-400">
                    Click &ldquo;Add Pin&rdquo; to place a comment on the image, or use the form below for a general comment.
                  </p>
                </div>
              )}
            </div>

            {/* General comment form */}
            <GeneralCommentForm
              authorName={authorName}
              onSubmit={(content) => submitComment(content)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ---- Pending pin comment form ---- */
function PendingPinForm({
  authorName,
  onSubmit,
  onCancel,
}: {
  authorName: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    await onSubmit(text);
    setText('');
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#017C87]/30 bg-[#017C87]/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <MapPin size={12} className="text-[#017C87]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#017C87]">
          New Pin Comment
        </span>
        <button type="button" onClick={onCancel} className="ml-auto p-0.5 text-gray-400 hover:text-gray-600">
          <X size={12} />
        </button>
      </div>
      <p className="text-[10px] text-gray-400">Posting as {authorName}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Describe your feedback…"
        className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
      />
      <button
        type="submit"
        disabled={!text.trim() || submitting}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#017C87] text-white text-xs font-medium hover:bg-[#01434A] disabled:opacity-40 transition-colors"
      >
        <Send size={11} />
        {submitting ? 'Sending…' : 'Post Comment'}
      </button>
    </form>
  );
}

/* ---- General (non-pin) comment form ---- */
function GeneralCommentForm({
  authorName,
  onSubmit,
}: {
  authorName: string;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    await onSubmit(text);
    setText('');
    setSubmitting(false);
    setExpanded(false);
  };

  return (
    <div className="border-t border-gray-200 px-4 py-3 shrink-0">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left px-3 py-2.5 rounded-lg text-xs text-gray-400 border border-gray-200 hover:border-gray-300 transition-colors"
        >
          Leave a general comment…
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-[10px] text-gray-400">Posting as {authorName}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Your comment…"
            className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#017C87] text-white text-xs font-medium hover:bg-[#01434A] disabled:opacity-40 transition-colors"
            >
              <Send size={11} />
              Post
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---- Comment thread with resolve/unresolve ---- */
function AdminCommentThread({
  comment,
  replies,
  authorName,
  onReply,
  onResolve,
  onUnresolve,
}: {
  comment: ReviewComment;
  replies: ReviewComment[];
  authorName: string;
  onReply: (content: string) => Promise<void>;
  onResolve: () => Promise<void>;
  onUnresolve: () => Promise<void>;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    await onReply(replyText);
    setReplyText('');
    setShowReply(false);
    setSubmitting(false);
  };

  const isTeam = comment.author_type === 'team';

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      {/* Pin badge */}
      {comment.comment_type === 'pin' && comment.thread_number && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-5 h-5 rounded-full bg-[#017C87] text-white flex items-center justify-center text-[10px] font-bold">
            {comment.thread_number}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-gray-400">Pin</span>
        </div>
      )}

      {/* Author + content */}
      <div className="flex items-start gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
          isTeam ? 'bg-[#017C87]/10 text-[#017C87]' : 'bg-gray-100 text-gray-500'
        }`}>
          {comment.author_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-900">{comment.author_name}</span>
            {isTeam && (
              <span className="text-[9px] font-medium uppercase bg-[#017C87]/10 text-[#017C87] px-1.5 py-0.5 rounded">
                Team
              </span>
            )}
            <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-2.5 ml-4 pl-4 border-l-2 border-gray-100 space-y-2">
          {replies.map((r) => {
            const rIsTeam = r.author_type === 'team';
            return (
              <div key={r.id} className="flex items-start gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${
                  rIsTeam ? 'bg-[#017C87]/10 text-[#017C87]' : 'bg-gray-100 text-gray-400'
                }`}>
                  {r.author_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-gray-900">{r.author_name}</span>
                    {rIsTeam && (
                      <span className="text-[8px] font-medium uppercase bg-[#017C87]/10 text-[#017C87] px-1 py-0.5 rounded">
                        Team
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{r.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions: Reply + Resolve */}
      <div className="flex items-center gap-3 mt-2.5 ml-8">
        {!showReply && (
          <button
            onClick={() => setShowReply(true)}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <CornerDownRight size={10} />
            Reply
          </button>
        )}
        {!comment.resolved ? (
          <button
            onClick={onResolve}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-emerald-600 transition-colors"
          >
            <CheckCircle2 size={10} />
            Resolve
          </button>
        ) : (
          <button
            onClick={onUnresolve}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-amber-600 transition-colors"
          >
            <RotateCcw size={10} />
            Reopen
          </button>
        )}
      </div>

      {/* Reply form */}
      {showReply && (
        <form onSubmit={handleReply} className="mt-2 ml-8 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              autoFocus
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || submitting}
              className="p-1.5 rounded-lg bg-[#017C87] text-white disabled:opacity-40 hover:bg-[#01434A] transition-colors"
            >
              <Send size={11} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---- Resolved section ---- */
function ResolvedSection({
  comments,
  getReplies,
  onUnresolve,
}: {
  comments: ReviewComment[];
  getReplies: (id: string) => ReviewComment[];
  onUnresolve: (commentId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
        Resolved ({comments.length})
      </button>
      {expanded && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 opacity-70">
              {c.comment_type === 'pin' && c.thread_number && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-4 h-4 rounded-full bg-gray-400 text-white flex items-center justify-center text-[9px] font-bold">
                    {c.thread_number}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">
                  {c.author_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-medium text-gray-500">{c.author_name}</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">{c.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-emerald-500" />
                      <span className="text-[10px] text-gray-400">
                        Resolved {c.resolved_by ? `by ${c.resolved_by}` : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => onUnresolve(c.id)}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-amber-600 transition-colors"
                    >
                      <RotateCcw size={9} />
                      Reopen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}