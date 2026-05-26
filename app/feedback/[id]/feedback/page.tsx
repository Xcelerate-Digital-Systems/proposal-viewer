'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import FeedbackRow from '@/components/admin/feedback/feedback-list/FeedbackRow';
import FeedbackModal from '@/components/admin/feedback/feedback-list/FeedbackModal';
import type { CommentWithItem } from '@/components/admin/feedback/feedback-list/types';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment } from '@/lib/supabase';
import type { FeedbackCommentPriority } from '@/lib/types/feedback';
import { PRIORITY_OPTIONS } from '@/components/feedback/comments/PrioritySelector';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatTimeAgo } from '@/lib/review-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

export default function ReviewFeedbackPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout>
      {(auth) => (
        <FeedbackGate
          accountType={auth.accountType}
          projectId={params.id}
          companyId={auth.companyId!}
          session={auth.session}
          teamMember={auth.teamMember}
        />
      )}
    </AdminLayout>
  );
}

function FeedbackGate({ accountType, projectId, companyId, session, teamMember }: {
  accountType?: 'agency' | 'client';
  projectId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { name?: string; email?: string } | null;
}) {
  const router = useRouter();
  const allowed = accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;

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

    // Notify project participants of the reply.
    if (project?.share_token) {
      const item = items.find((i) => i.id === parent.review_item_id);
      fetch('/api/review-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'review_comment_added',
          share_token: project.share_token,
          review_item_id: parent.review_item_id,
          comment_author: authorName,
          comment_author_email: teamMember?.email || null,
          comment_content: trimmed,
          item_title: item?.title,
          parent_comment_id: parent.id,
          author_type: 'team',
        }),
      }).catch(() => {});
    }

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
              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
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
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
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
                      onSelect={() => setSelectedComment(comment)}
                      onViewItem={() =>
                        router.push(
                          `/feedback/${projectId}/items/${comment.review_item_id}?type=${encodeURIComponent(comment.item_type)}`
                        )
                      }
                      onToggleResolve={() => handleToggleResolve(comment, !comment.resolved)}
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
