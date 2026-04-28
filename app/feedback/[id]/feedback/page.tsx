'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, CheckCircle2, Circle, X, Globe, Image as ImageIcon, Mail, Smartphone, Monitor, ChevronDown, ChevronUp, ExternalLink, Clock, Send, Trash2 } from 'lucide-react';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment } from '@/lib/supabase';
import type { FeedbackCommentPriority } from '@/lib/types/feedback';
import { getPriorityDef, PRIORITY_OPTIONS } from '@/components/feedback/comments/PrioritySelector';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CommentWithItem = FeedbackComment & {
  item_title: string;
  item_type: string;
  item_url: string | null;
  reply_count: number;
  screenshot_url?: string | null;
  video_url?: string | null;
  annotation_data?: unknown;
};

type ReviewCompletion = {
  id: string;
  review_project_id: string;
  reviewer_name: string | null;
  reviewer_email: string | null;
  message: string | null;
  completed_at: string;
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
          session={auth.session}
          teamMember={auth.teamMember}
        />
      )}
    </AdminLayout>
  );
}

function FeedbackGate({ isSuperAdmin, projectId, companyId, session, teamMember }: {
  isSuperAdmin?: boolean;
  projectId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { name?: string; email?: string } | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return <FeedbackContent projectId={projectId} companyId={companyId} session={session} teamMember={teamMember} />;
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function FeedbackContent({ projectId, companyId, session, teamMember }: {
  projectId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { name?: string; email?: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [allComments, setAllComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackCommentPriority | 'all'>('all');
  const [selectedComment, setSelectedComment] = useState<CommentWithItem | null>(null);
  const [completions, setCompletions] = useState<ReviewCompletion[]>([]);
  const [completionsOpen, setCompletionsOpen] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);

  const authorName = teamMember?.name || teamMember?.email || 'Team';

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) { router.push('/feedback'); return; }
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

    // Fetch completion submissions (reviewers hitting the Finish flow)
    const { data: completionsData } = await supabase
      .from('review_completions')
      .select('*')
      .eq('review_project_id', projectId)
      .order('completed_at', { ascending: false });

    setCompletions((completionsData as ReviewCompletion[]) || []);

    setLoading(false);
  }, [projectId]);

  const fetchCustomDomain = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    }
  }, [companyId]);

  useEffect(() => {
    fetchProject();
    fetchData();
    fetchCustomDomain();
  }, [fetchProject, fetchData, fetchCustomDomain]);

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
        video_url: (c as Record<string, unknown>).video_url as string | null,
        annotation_data: ((c as Record<string, unknown>).annotation_data as Record<string, unknown> | null) ?? null,
      };
    });
  }, [allComments, items]);

  const openComments = enrichedComments.filter((c) => !c.resolved);
  const resolvedComments = enrichedComments.filter((c) => c.resolved);
  const baseDisplayed = tab === 'open' ? openComments : resolvedComments;
  const displayed = priorityFilter === 'all'
    ? baseDisplayed
    : baseDisplayed.filter((c) => (c.priority || 'none') === priorityFilter);

  const hasWebpages = items.some((i) => i.type === 'webpage');

  // Submit reply to a top-level comment
  const handleSubmitReply = async (parent: CommentWithItem, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    const insertData: Record<string, unknown> = {
      review_item_id: parent.review_item_id,
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
    return true;
  };

  // Delete a comment (and its replies)
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
    setSelectedComment(null);
    toast.success('Comment deleted');
  };

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
      {project && (
        <FeedbackProjectHeader
          projectId={projectId}
          project={project}
          setProject={setProject}
          customDomain={customDomain}
          hasWebpages={hasWebpages}
          activeTab="feedback"
          onAddItem={() => setShowAddItem(true)}
        />
      )}

      {showAddItem && project && session?.user?.id && (
        <AddFeedbackItemModal
          reviewProjectId={project.id}
          companyId={companyId}
          userId={session.user.id}
          nextSortOrder={items.length}
          onClose={() => setShowAddItem(false)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : enrichedComments.length === 0 && completions.length === 0 ? (
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
          <div className="max-w-4xl space-y-4">
            {completions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCompletionsOpen((o) => !o)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {completions.length} reviewer{completions.length !== 1 ? 's' : ''} finished reviewing
                    </p>
                    <p className="text-xs text-gray-400">
                      Most recent: {formatTimeAgo(completions[0].completed_at)}
                    </p>
                  </div>
                  {completionsOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>

                {completionsOpen && (
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {completions.map((c) => (
                      <div key={c.id} className="flex items-start gap-3 px-5 py-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 text-[11px] font-semibold text-emerald-700">
                          {(c.reviewer_name?.trim()[0] ?? '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-gray-900 truncate">
                              {c.reviewer_name || 'Anonymous reviewer'}
                            </span>
                            {c.reviewer_email && (
                              <span className="text-gray-400 truncate">· {c.reviewer_email}</span>
                            )}
                            <span className="text-gray-400 shrink-0 ml-auto">{formatTimeAgo(c.completed_at)}</span>
                          </div>
                          {c.message && (
                            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Open / Resolved toggle */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Filter bar */}
              <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 flex-wrap">
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

                {/* Priority filter — appears after a divider */}
                <span className="w-px h-4 bg-gray-200" />
                <button
                  onClick={() => setPriorityFilter('all')}
                  className={`text-xs font-medium transition-colors ${
                    priorityFilter === 'all' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  All priorities
                </button>
                {PRIORITY_OPTIONS.filter((p) => p.value !== 'none').map((p) => {
                  const Icon = p.icon;
                  const active = priorityFilter === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPriorityFilter(active ? 'all' : p.value)}
                      className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                        active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <Icon size={12} className={p.iconClass} />
                      {p.label}
                    </button>
                  );
                })}
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
          onSubmitReply={handleSubmitReply}
          onDelete={handleDeleteComment}
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
  const priorityDef = comment.priority && comment.priority !== 'none' ? getPriorityDef(comment.priority) : null;
  const PriorityIcon = priorityDef?.icon;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
    >
      {/* Thread number badge */}
      <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
        {comment.thread_number ? (
          <span className="text-xs font-bold text-teal">
            #{comment.thread_number}
          </span>
        ) : (
          <MessageSquare size={14} className="text-teal" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="text-sm text-gray-900 line-clamp-2 leading-relaxed flex-1">
            {comment.content}
          </p>
          {priorityDef && PriorityIcon && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-medium uppercase shrink-0 ${priorityDef.badgeClass}`}
              title={`Priority: ${priorityDef.label}`}
            >
              <PriorityIcon size={9} className={priorityDef.iconClass} />
              {priorityDef.label}
            </span>
          )}
        </div>
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
              <span className="text-teal">
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
  onSubmitReply,
  onDelete,
}: {
  comment: CommentWithItem;
  allComments: FeedbackComment[];
  onClose: () => void;
  onToggleResolve: (comment: CommentWithItem, resolved: boolean) => void;
  onSubmitReply: (parent: CommentWithItem, content: string) => Promise<boolean>;
  onDelete: (comment: CommentWithItem) => void;
}) {
  const [showReplies, setShowReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const replies = allComments
    .filter((c) => c.parent_comment_id === comment.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const handleReplySubmit = async () => {
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    const ok = await onSubmitReply(comment, replyText);
    setSubmittingReply(false);
    if (ok) {
      setReplyText('');
      setShowReplies(true);
    }
  };

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
              <span className="px-2 py-0.5 rounded-md bg-teal/10 text-xs font-bold text-teal">
                #{comment.thread_number}
              </span>
            )}
            <span className="text-sm text-gray-500 truncate">
              Reported by <span className="font-medium text-gray-700">{comment.author_name}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onDelete(comment)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
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

              {/* Video */}
              {comment.video_url && (
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-black">
                  <video
                    src={comment.video_url}
                    controls
                    preload="metadata"
                    className="w-full block max-h-[400px]"
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

              {/* Reply composer */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleReplySubmit();
                      }
                    }}
                    placeholder="Reply to this feedback…"
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                  />
                  <button
                    onClick={handleReplySubmit}
                    disabled={!replyText.trim() || submittingReply}
                    className="flex items-center gap-1.5 bg-teal text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={14} />
                    Reply
                  </button>
                </div>
              </div>
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
                    className="inline-flex items-center gap-1.5 text-xs text-teal hover:text-teal-hover transition-colors truncate max-w-full"
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