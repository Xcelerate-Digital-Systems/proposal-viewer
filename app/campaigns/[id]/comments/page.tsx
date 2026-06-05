'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, CheckCircle2, Circle, CircleDashed,
  ListTodo, Paperclip, Send,
} from 'lucide-react';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import FeedbackRow from '@/components/admin/feedback/feedback-list/FeedbackRow';
import FeedbackModal from '@/components/admin/feedback/feedback-list/FeedbackModal';
import TaskModal from '@/components/admin/feedback/feedback-list/TaskModal';
import TaskDetailModal from '@/components/admin/feedback/feedback-list/TaskDetailModal';
import type { CommentWithItem } from '@/components/admin/feedback/feedback-list/types';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment } from '@/lib/supabase';
import type { CommentTask, CommentTaskAttachment, FeedbackCommentPriority } from '@/lib/types/feedback';
import { PRIORITY_OPTIONS } from '@/components/feedback/comments/PrioritySelector';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';


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

type TeamMemberOption = { id: string; name: string; email: string };

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
  teamMember: { id?: string; name?: string; email?: string } | null;
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
  teamMember: { id?: string; name?: string; email?: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [allComments, setAllComments] = useState<FeedbackComment[]>([]);
  const [allTasks, setAllTasks] = useState<CommentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackCommentPriority | 'all'>('all');
  const [selectedComment, setSelectedComment] = useState<CommentWithItem | null>(null);
  const [taskingComment, setTaskingComment] = useState<CommentWithItem | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<{ task: CommentTask; comment: CommentWithItem } | null>(null);
  const [completions, setCompletions] = useState<ReviewCompletion[]>([]);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [memberNameMap, setMemberNameMap] = useState<Record<string, string>>({});

  const authorName = teamMember?.name || teamMember?.email || 'Team';
  const currentMemberId = teamMember?.id ?? null;

  // Fetch all company team members
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name, email')
        .eq('company_id', companyId)
        .order('name');
      if (cancelled) return;
      const members: TeamMemberOption[] = [];
      const nameMap: Record<string, string> = {};
      for (const m of data ?? []) {
        const tm = m as { id: string; name: string | null; email: string };
        const name = tm.name?.trim() || tm.email;
        members.push({ id: tm.id, name, email: tm.email });
        nameMap[tm.id] = name;
      }
      setTeamMembers(members);
      setMemberNameMap(nameMap);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) { router.push('/campaigns'); return; }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchData = useCallback(async () => {
    const { data: itemsData } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });

    const fetchedItems = itemsData || [];
    setItems(fetchedItems);

    const itemIds = fetchedItems.map((i) => i.id);

    // Fetch item-level comments and project-level comments in parallel
    const [itemCommentsRes, projectCommentsRes] = await Promise.all([
      itemIds.length > 0
        ? supabase
            .from('review_comments')
            .select('*')
            .in('review_item_id', itemIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('review_comments')
        .select('*')
        .eq('review_project_id', projectId)
        .is('review_item_id', null)
        .order('created_at', { ascending: false }),
    ]);

    const comments = [
      ...(itemCommentsRes.data || []),
      ...(projectCommentsRes.data || []),
    ] as FeedbackComment[];
    setAllComments(comments);

    // Fetch tasks for all comments in the project
    const commentIds = comments.filter((c) => !c.parent_comment_id).map((c) => c.id);
    if (commentIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('comment_tasks')
        .select('*')
        .in('comment_id', commentIds)
        .order('created_at', { ascending: true });
      setAllTasks((tasksData as CommentTask[]) || []);
    }

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

  // Build task map: comment_id → CommentTask[]
  const tasksByComment = useMemo(() => {
    const map = new Map<string, CommentTask[]>();
    for (const t of allTasks) {
      const arr = map.get(t.comment_id) ?? [];
      arr.push(t);
      map.set(t.comment_id, arr);
    }
    return map;
  }, [allTasks]);

  // Build enriched top-level comments
  const enrichedComments: CommentWithItem[] = useMemo(() => {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const topLevel = allComments.filter((c) => !c.parent_comment_id);

    return topLevel.map((c) => {
      const isProjectLevel = !c.review_item_id;
      const item = c.review_item_id ? itemMap.get(c.review_item_id) : null;
      const replies = allComments.filter((r) => r.parent_comment_id === c.id);
      return {
        ...c,
        item_title: isProjectLevel ? 'Campaign' : (item?.title || 'Unknown item'),
        item_type: isProjectLevel ? 'campaign' : (item?.type || 'image'),
        item_url: item?.url || null,
        reply_count: replies.length,
        screenshot_url: (c as Record<string, unknown>).screenshot_url as string | null,
        video_url: (c as Record<string, unknown>).video_url as string | null,
        annotation_data: ((c as Record<string, unknown>).annotation_data as Record<string, unknown> | null) ?? null,
        tasks: tasksByComment.get(c.id) ?? [],
      };
    });
  }, [allComments, items, tasksByComment]);

  const openComments = enrichedComments.filter((c) => !c.resolved);
  const resolvedComments = enrichedComments.filter((c) => c.resolved);
  const baseDisplayed = tab === 'open' ? openComments : resolvedComments;
  const displayed = priorityFilter === 'all'
    ? baseDisplayed
    : baseDisplayed.filter((c) => (c.priority || 'none') === priorityFilter);

  const hasWebpages = items.some((i) => i.type === 'webpage');

  // All tasks for the right-side panel
  const allProjectTasks = useMemo(() => {
    const openTasks: (CommentTask & { commentContent: string; commentThreadNum: number | null })[] = [];
    const doneTasks: (CommentTask & { commentContent: string; commentThreadNum: number | null })[] = [];
    for (const c of enrichedComments) {
      for (const t of c.tasks ?? []) {
        const entry = { ...t, commentContent: c.content || '', commentThreadNum: c.thread_number };
        if (t.completed_at) doneTasks.push(entry);
        else openTasks.push(entry);
      }
    }
    return { openTasks, doneTasks, total: openTasks.length + doneTasks.length };
  }, [enrichedComments]);

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
      if (selectedComment?.id === comment.id) {
        setSelectedComment((prev) =>
          prev ? { ...prev, resolved: updated.resolved, resolved_at: updated.resolved_at } : prev
        );
      }
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

  // Keep selectedComment in sync with tasks
  useEffect(() => {
    if (!selectedComment) return;
    const tasks = tasksByComment.get(selectedComment.id) ?? [];
    if (JSON.stringify(selectedComment.tasks) !== JSON.stringify(tasks)) {
      setSelectedComment((prev) => prev ? { ...prev, tasks } : prev);
    }
  }, [tasksByComment, selectedComment]);

  // Keep taskingComment in sync with tasks
  useEffect(() => {
    if (!taskingComment) return;
    const tasks = tasksByComment.get(taskingComment.id) ?? [];
    if (JSON.stringify(taskingComment.tasks) !== JSON.stringify(tasks)) {
      setTaskingComment((prev) => prev ? { ...prev, tasks } : prev);
    }
  }, [tasksByComment, taskingComment]);

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
          activeTab="comments"
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
          onSuccess={() => { fetchData(); }}
        />
      )}

      {/* Two-column layout */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : enrichedComments.length === 0 && completions.length === 0 ? (
          <div className="space-y-4">
            <GeneralCommentComposer onSubmit={handleSubmitGeneralComment} />
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={28} className="text-faint" />
              </div>
              <h3 className="text-lg font-semibold text-dim mb-1">No feedback yet</h3>
              <p className="text-sm text-faint">
                Feedback from clients and team members will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 h-full -mx-1">
            {/* Left column — comments */}
            <div className={`min-w-0 overflow-y-auto space-y-4 px-1 ${showTasks ? 'hidden lg:block lg:w-[55%]' : 'w-full lg:w-[55%]'}`}>
              {/* General comment composer */}
              <GeneralCommentComposer onSubmit={handleSubmitGeneralComment} />

              {/* Open / Resolved toggle + comment list */}
              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                {/* Filter bar */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-edge flex-wrap">
                  <button
                    onClick={() => setTab('open')}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      tab === 'open' ? 'text-ink' : 'text-faint hover:text-prose'
                    }`}
                  >
                    <Circle size={14} />
                    Open
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                      tab === 'open' ? 'bg-surface text-prose' : 'bg-surface text-faint'
                    }`}>
                      {openComments.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setTab('resolved')}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      tab === 'resolved' ? 'text-ink' : 'text-faint hover:text-prose'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    Resolved
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                      tab === 'resolved' ? 'bg-surface text-prose' : 'bg-surface text-faint'
                    }`}>
                      {resolvedComments.length}
                    </span>
                  </button>

                  <span className="w-px h-4 bg-edge" />
                  <button
                    onClick={() => setPriorityFilter('all')}
                    className={`text-xs font-medium transition-colors ${
                      priorityFilter === 'all' ? 'text-ink' : 'text-faint hover:text-prose'
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
                          active ? 'text-ink' : 'text-faint hover:text-prose'
                        }`}
                      >
                        <Icon size={14} className={p.iconClass} />
                        {p.label}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setShowTasks((s) => !s)}
                    className={`lg:hidden ml-auto flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      showTasks ? 'text-teal' : 'text-faint hover:text-prose'
                    }`}
                  >
                    <ListTodo size={14} />
                    Tasks
                    {allProjectTasks.total > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-surface text-2xs font-semibold">
                        {allProjectTasks.openTasks.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* List */}
                {displayed.length === 0 ? (
                  <div className="py-12 text-center text-sm text-faint">
                    {tab === 'open' ? 'No open feedback' : 'No resolved feedback'}
                  </div>
                ) : (
                  <div className="divide-y divide-edge">
                    {displayed.map((comment) => (
                      <FeedbackRow
                        key={comment.id}
                        comment={comment}
                        onSelect={() => setSelectedComment(comment)}
                        onViewItem={comment.review_item_id
                          ? () => router.push(
                              `/campaigns/${projectId}/assets/${comment.review_item_id}?type=${encodeURIComponent(comment.item_type)}`
                            )
                          : undefined
                        }
                        onToggleResolve={() => handleToggleResolve(comment, !comment.resolved)}
                        onOpenTasks={() => setTaskingComment(comment)}
                        memberNameMap={memberNameMap}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column — tasks panel */}
            <div className={`min-w-0 overflow-y-auto px-1 ${showTasks ? 'w-full lg:w-[45%]' : 'hidden lg:block lg:w-[45%]'}`}>
              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                <div className="px-5 py-3 border-b border-edge">
                  <div className="flex items-center gap-2">
                    <ListTodo size={16} className="text-teal" />
                    <h3 className="text-sm font-semibold text-ink">Tasks</h3>
                    {allProjectTasks.total > 0 && (
                      <span className="ml-auto text-xs text-faint">
                        {allProjectTasks.doneTasks.length}/{allProjectTasks.total} done
                      </span>
                    )}
                  </div>
                </div>

                {allProjectTasks.total === 0 ? (
                  <div className="py-12 text-center">
                    <ListTodo size={24} className="text-faint mx-auto mb-2" />
                    <p className="text-sm text-faint">No tasks yet</p>
                    <p className="text-xs text-faint mt-1">Create tasks from comments</p>
                  </div>
                ) : (
                  <div className="divide-y divide-edge">
                    {allProjectTasks.openTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        memberNameMap={memberNameMap}
                        onToggleComplete={() => toggleTaskComplete(task.comment_id, task.id, true)}
                        onViewComment={() => {
                          const c = enrichedComments.find((ec) => ec.id === task.comment_id);
                          if (c) setSelectedTaskDetail({ task, comment: c });
                        }}
                      />
                    ))}
                    {allProjectTasks.doneTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        memberNameMap={memberNameMap}
                        onToggleComplete={() => toggleTaskComplete(task.comment_id, task.id, false)}
                        onViewComment={() => {
                          const c = enrichedComments.find((ec) => ec.id === task.comment_id);
                          if (c) setSelectedTaskDetail({ task, comment: c });
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
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
          memberNameMap={memberNameMap}
          currentMemberId={currentMemberId}
          onOpenTasks={() => { setTaskingComment(selectedComment); }}
          onQuickAssign={(memberId, instructions) => quickAssign(selectedComment.id, memberId, instructions)}
          onToggleTaskComplete={toggleTaskComplete}
          onRemoveTask={removeTask}
          onPriorityChange={changePriority}
          onOpenTaskDetail={(task) => setSelectedTaskDetail({ task, comment: selectedComment })}
          teamMembers={teamMembers}
          projectId={projectId}
          participantsUrl={`/api/campaigns/${projectId}/participants?company_id=${companyId}`}
        />
      )}

      {/* Task Modal (create new) */}
      {taskingComment && (
        <TaskModal
          commentId={taskingComment.id}
          commentContent={taskingComment.content || ''}
          companyId={companyId}
          currentMemberId={currentMemberId}
          existingTasks={taskingComment.tasks ?? []}
          teamMembers={teamMembers}
          memberNameMap={memberNameMap}
          onCreateTask={createTask}
          onToggleComplete={toggleTaskComplete}
          onRemoveTask={removeTask}
          onClose={() => setTaskingComment(null)}
        />
      )}

      {/* Task Detail Modal (view existing) */}
      {selectedTaskDetail && (
        <TaskDetailModal
          task={selectedTaskDetail.task}
          commentContent={selectedTaskDetail.comment.content || ''}
          commentAuthorName={selectedTaskDetail.comment.author_name}
          commentCreatedAt={selectedTaskDetail.comment.created_at}
          commentScreenshotUrl={selectedTaskDetail.comment.screenshot_url}
          commentVideoUrl={selectedTaskDetail.comment.video_url}
          commentThreadNumber={selectedTaskDetail.comment.thread_number}
          itemTitle={selectedTaskDetail.comment.item_title}
          itemType={selectedTaskDetail.comment.item_type}
          itemUrl={selectedTaskDetail.comment.item_url}
          projectId={projectId}
          reviewItemId={selectedTaskDetail.comment.review_item_id ?? undefined}
          companyId={companyId}
          currentMemberId={currentMemberId}
          memberNameMap={memberNameMap}
          teamMembers={teamMembers}
          existingTasks={selectedTaskDetail.comment.tasks ?? []}
          onToggleComplete={toggleTaskComplete}
          onRemoveTask={removeTask}
          onCreateTask={createTask}
          onClose={() => setSelectedTaskDetail(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task row for the right panel                                       */
/* ------------------------------------------------------------------ */

function TaskRow({ task, memberNameMap, onToggleComplete, onViewComment }: {
  task: CommentTask & { commentContent: string; commentThreadNum: number | null };
  memberNameMap: Record<string, string>;
  onToggleComplete: () => void;
  onViewComment: () => void;
}) {
  const name = memberNameMap[task.assigned_to] || 'Team member';
  const done = !!task.completed_at;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewComment(); } }}
      className={`px-4 py-3 hover:bg-surface/50 transition-colors cursor-pointer ${done ? 'opacity-60' : ''}`}
      onClick={onViewComment}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
          className="shrink-0"
          title={done ? 'Reopen' : 'Mark complete'}
        >
          {done ? (
            <CheckCircle2 size={16} className="text-emerald-500 hover:text-emerald-600" />
          ) : (
            <CircleDashed size={16} className="text-amber-500 hover:text-amber-600" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${done ? 'text-faint line-through' : 'text-ink'}`}>
            {name}
          </p>
          {task.instructions && (
            <p className="text-xs text-faint truncate mt-0.5">{task.instructions}</p>
          )}
        </div>
        {task.commentThreadNum && (
          <span className="px-1.5 py-0.5 rounded bg-teal/10 text-2xs font-bold text-teal shrink-0">
            #{task.commentThreadNum}
          </span>
        )}
      </div>
      {task.attachments && task.attachments.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 ml-6">
          <Paperclip size={10} className="text-faint" />
          <span className="text-2xs text-faint">{task.attachments.length} file{task.attachments.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  General comment composer                                           */
/* ------------------------------------------------------------------ */

function GeneralCommentComposer({ onSubmit }: { onSubmit: (content: string) => Promise<boolean> }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEmpty = !value.trim();

  const handleSubmit = async () => {
    if (isEmpty || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(value);
    setSubmitting(false);
    if (ok) setValue('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden px-5 py-4">
      <p className="text-xs font-medium text-dim mb-2">Add a general comment</p>
      <div className="flex items-start gap-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Leave feedback about this campaign…"
          rows={2}
          className="flex-1 text-sm rounded-lg border border-edge-strong px-3 py-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
        />
        <Button
          size="sm"
          loading={submitting}
          disabled={isEmpty || submitting}
          leftIcon={Send}
          onClick={handleSubmit}
        >
          Post
        </Button>
      </div>
    </div>
  );
}
