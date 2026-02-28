// app/reviews/[id]/feedback/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft,  MessageSquare, CheckCircle2, Circle, X, Globe, Image as ImageIcon, Mail, Smartphone, Monitor, ChevronDown, ChevronUp, ExternalLink, Clock, } from 'lucide-react';
import ProjectTabs from '@/components/admin/reviews/ProjectTabs';
import { supabase, type ReviewProject, type ReviewItem, type ReviewComment } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CommentWithItem = ReviewComment & {
  item_title: string;
  item_type: string;
  item_url: string | null;
  reply_count: number;
  screenshot_url?: string | null;
  annotation_data?: unknown;
};

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function ReviewFeedbackPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <FeedbackGate
          isSuperAdmin={auth.isSuperAdmin}
          projectId={params.id}
          companyId={auth.companyId!}
        />
      )}
    </AdminLayout>
  );
}

function FeedbackGate({ isSuperAdmin, projectId, companyId }: {
  isSuperAdmin?: boolean; projectId: string; companyId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return <FeedbackContent projectId={projectId} companyId={companyId} />;
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function FeedbackContent({ projectId, companyId }: { projectId: string; companyId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [allComments, setAllComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [selectedComment, setSelectedComment] = useState<CommentWithItem | null>(null);

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) { router.push('/reviews'); return; }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchData = useCallback(async () => {
    // Fetch items
    const { data: itemsData } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });

    const fetchedItems = itemsData || [];
    setItems(fetchedItems);

    // Fetch all comments for all items in project
    const itemIds = fetchedItems.map((i) => i.id);
    if (itemIds.length > 0) {
      const { data: commentsData } = await supabase
        .from('review_comments')
        .select('*')
        .in('review_item_id', itemIds)
        .order('created_at', { ascending: false });

      setAllComments(commentsData || []);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchData();
  }, [fetchProject, fetchData]);

  // Build enriched top-level comments with item info + reply counts
  const enrichedComments: CommentWithItem[] = useMemo(() => {
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Only top-level comments (no parent)
    const topLevel = allComments.filter((c) => !c.parent_comment_id);

    return topLevel.map((c) => {
      const item = itemMap.get(c.review_item_id);
      const replies = allComments.filter((r) => r.parent_comment_id === c.id);
      return {
        ...c,
        item_title: item?.title || 'Unknown item',
        item_type: item?.type || 'image',
        item_url: item?.url || null,
        reply_count: replies.length,
        screenshot_url: (c as Record<string, unknown>).screenshot_url as string | null,
        annotation_data: (c as Record<string, unknown>).annotation_data,
      };
    });
  }, [allComments, items]);

  const openComments = enrichedComments.filter((c) => !c.resolved);
  const resolvedComments = enrichedComments.filter((c) => c.resolved);
  const displayed = tab === 'open' ? openComments : resolvedComments;

  const hasWebpages = items.some((i) => i.type === 'webpage');

  // Toggle resolve
  const handleToggleResolve = async (comment: CommentWithItem, resolved: boolean) => {
    await supabase
      .from('review_comments')
      .update({
        resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq('id', comment.id);

    // Refresh
    setAllComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? { ...c, resolved, resolved_at: resolved ? new Date().toISOString() : null }
          : c
      )
    );

    // Update selected if open
    if (selectedComment?.id === comment.id) {
      setSelectedComment((prev) =>
        prev ? { ...prev, resolved, resolved_at: resolved ? new Date().toISOString() : null } : prev
      );
    }
  };

  if (!project && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          All Projects
        </Link>

        {project && (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
                  {project.title}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  {project.client_name && (
                    <span className="text-sm text-gray-400">{project.client_name}</span>
                  )}
                </div>
              </div>
            </div>
            <ProjectTabs projectId={projectId} activeTab="feedback" hasWebpages={items.some((i) => i.type === 'webpage')} />
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          </div>
        ) : enrichedComments.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No feedback yet</h3>
            <p className="text-sm text-gray-400">
              Feedback from clients and team members will appear here.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl">
            {/* Open / Resolved toggle */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Filter bar */}
              <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100">
                <button
                  onClick={() => setTab('open')}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    tab === 'open' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Circle size={14} />
                  Open
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                    tab === 'open' ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {openComments.length}
                  </span>
                </button>
                <button
                  onClick={() => setTab('resolved')}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    tab === 'resolved' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  Resolved
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                    tab === 'resolved' ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {resolvedComments.length}
                  </span>
                </button>
              </div>

              {/* List */}
              {displayed.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  {tab === 'open' ? 'No open feedback' : 'No resolved feedback'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {displayed.map((comment) => (
                    <FeedbackRow
                      key={comment.id}
                      comment={comment}
                      onClick={() => setSelectedComment(comment)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedComment && (
        <FeedbackModal
          comment={selectedComment}
          allComments={allComments}
          onClose={() => setSelectedComment(null)}
          onToggleResolve={handleToggleResolve}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feedback row                                                       */
/* ------------------------------------------------------------------ */

const TYPE_ICONS: Record<string, typeof Globe> = {
  webpage: Globe,
  image: ImageIcon,
  email: Mail,
  sms: Smartphone,
  ad: Monitor,
};

function FeedbackRow({ comment, onClick }: { comment: CommentWithItem; onClick: () => void }) {
  const TypeIcon = TYPE_ICONS[comment.item_type] || MessageSquare;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
    >
      {/* Thread number badge */}
      <div className="w-8 h-8 rounded-lg bg-[#017C87]/10 flex items-center justify-center shrink-0 mt-0.5">
        {comment.thread_number ? (
          <span className="text-xs font-bold text-[#017C87]">
            #{comment.thread_number}
          </span>
        ) : (
          <MessageSquare size={14} className="text-[#017C87]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 line-clamp-2 leading-relaxed">
          {comment.content}
        </p>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
          <TypeIcon size={12} />
          <span className="truncate max-w-[200px]">{comment.item_title}</span>
          <span>·</span>
          <span>{comment.author_name}</span>
          <span>·</span>
          <span>{formatTimeAgo(comment.created_at)}</span>
          {comment.reply_count > 0 && (
            <>
              <span>·</span>
              <span className="text-[#017C87]">
                {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Resolved indicator */}
      {comment.resolved && (
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-1" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Feedback detail modal                                              */
/* ------------------------------------------------------------------ */

function FeedbackModal({
  comment,
  allComments,
  onClose,
  onToggleResolve,
}: {
  comment: CommentWithItem;
  allComments: ReviewComment[];
  onClose: () => void;
  onToggleResolve: (comment: CommentWithItem, resolved: boolean) => void;
}) {
  const [showReplies, setShowReplies] = useState(true);

  const replies = allComments
    .filter((c) => c.parent_comment_id === comment.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {comment.thread_number && (
              <span className="px-2 py-0.5 rounded-md bg-[#017C87]/10 text-xs font-bold text-[#017C87]">
                #{comment.thread_number}
              </span>
            )}
            <span className="text-sm text-gray-500 truncate">
              Reported by <span className="font-medium text-gray-700">{comment.author_name}</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row">
            {/* Left — screenshot + comment */}
            <div className="flex-1 p-6 space-y-4 min-w-0">
              {/* Screenshot */}
              {comment.screenshot_url && (
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                  <img
                    src={comment.screenshot_url}
                    alt="Screenshot"
                    className="w-full object-contain max-h-[400px]"
                  />
                </div>
              )}

              {/* Comment text */}
              <div>
                <p className="text-gray-900 leading-relaxed">{comment.content}</p>
                <p className="text-xs text-gray-400 mt-2 italic">No description</p>
              </div>

              {/* Replies */}
              {replies.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => setShowReplies(!showReplies)}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mb-3"
                  >
                    {showReplies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                  </button>

                  {showReplies && (
                    <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                      {replies.map((reply) => (
                        <div key={reply.id} className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-700">{reply.author_name}</span>
                            <span className="text-xs text-gray-400">{formatTimeAgo(reply.created_at)}</span>
                          </div>
                          <p className="text-gray-600 leading-relaxed">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right — metadata sidebar */}
            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-gray-100 p-6 bg-gray-50/50 shrink-0 space-y-5">
              {/* Meta: date */}
              <div className="text-xs text-gray-400">
                {new Date(comment.created_at).toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {', '}
                {new Date(comment.created_at).toLocaleTimeString('en-AU', {
                  hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </div>

              {/* Status */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Status</p>
                <button
                  onClick={() => onToggleResolve(comment, !comment.resolved)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    comment.resolved
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {comment.resolved ? (
                    <>
                      <CheckCircle2 size={12} />
                      Resolved
                    </>
                  ) : (
                    <>
                      <Clock size={12} />
                      Open
                    </>
                  )}
                </button>
              </div>

              {/* Item */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Item</p>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  {(() => {
                    const TypeIcon = TYPE_ICONS[comment.item_type] || MessageSquare;
                    return <TypeIcon size={14} className="text-gray-400 shrink-0" />;
                  })()}
                  <span className="truncate">{comment.item_title}</span>
                </div>
              </div>

              {/* Type */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Type</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                  {comment.comment_type?.replace('_', ' ') || 'general'}
                </span>
              </div>

              {/* Author */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Author</p>
                <p className="text-sm text-gray-700">{comment.author_name}</p>
                {comment.author_email && (
                  <p className="text-xs text-gray-400 mt-0.5">{comment.author_email}</p>
                )}
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 capitalize">
                  {comment.author_type}
                </span>
              </div>

              {/* Page URL */}
              {comment.item_url && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Page</p>
                  <a
                    href={comment.item_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#017C87] hover:text-[#015c64] transition-colors truncate max-w-full"
                  >
                    <ExternalLink size={11} className="shrink-0" />
                    <span className="truncate">{comment.item_url}</span>
                  </a>
                </div>
              )}

              {/* Resolved info */}
              {comment.resolved && comment.resolved_at && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Resolved</p>
                  <p className="text-xs text-gray-400">
                    {new Date(comment.resolved_at).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}