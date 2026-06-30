'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, CheckCircle2, Circle,
  ListTodo,
} from 'lucide-react';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import FeedbackRow from '@/components/admin/feedback/feedback-list/FeedbackRow';
import FeedbackModal from '@/components/admin/feedback/feedback-list/FeedbackModal';
import TaskModal from '@/components/admin/feedback/feedback-list/TaskModal';
import TaskDetailModal from '@/components/admin/feedback/feedback-list/TaskDetailModal';
import type { CommentWithItem } from '@/components/admin/feedback/feedback-list/types';
import type { CommentTask, FeedbackCommentPriority } from '@/lib/types/feedback';
import { PRIORITY_OPTIONS } from '@/components/feedback/comments/PrioritySelector';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useCommentsPageData } from './useCommentsPageData';
import { useCommentsPageActions } from './useCommentsPageActions';
import TaskRow from './TaskRow';
import GeneralCommentComposer from './GeneralCommentComposer';

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

function FeedbackContent({ projectId, companyId, session, teamMember }: {
  projectId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { id?: string; name?: string; email?: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackCommentPriority | 'all'>('all');
  const [selectedComment, setSelectedComment] = useState<CommentWithItem | null>(null);
  const [taskingComment, setTaskingComment] = useState<CommentWithItem | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<{ task: CommentTask; comment: CommentWithItem } | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  const authorName = teamMember?.name || teamMember?.email || 'Team';
  const currentMemberId = teamMember?.id ?? null;

  const data = useCommentsPageData(projectId, companyId);
  const actions = useCommentsPageActions({
    projectId,
    companyId,
    session,
    teamMember,
    project: data.project,
    items: data.items,
    authorName,
    memberNameMap: data.memberNameMap,
    toast,
    confirm,
    setAllComments: data.setAllComments,
    setAllTasks: data.setAllTasks,
    setSelectedComment,
  });

  const openComments = data.enrichedComments.filter((c) => !c.resolved);
  const resolvedComments = data.enrichedComments.filter((c) => c.resolved);
  const baseDisplayed = tab === 'open' ? openComments : resolvedComments;
  const displayed = priorityFilter === 'all'
    ? baseDisplayed
    : baseDisplayed.filter((c) => (c.priority || 'none') === priorityFilter);

  const hasWebpages = data.items.some((i) => i.type === 'webpage');

  const allProjectTasks = useMemo(() => {
    const openTasks: (CommentTask & { commentContent: string; commentThreadNum: number | null })[] = [];
    const doneTasks: (CommentTask & { commentContent: string; commentThreadNum: number | null })[] = [];
    for (const c of data.enrichedComments) {
      for (const t of c.tasks ?? []) {
        const entry = { ...t, commentContent: c.content || '', commentThreadNum: c.thread_number };
        if (t.completed_at) doneTasks.push(entry);
        else openTasks.push(entry);
      }
    }
    return { openTasks, doneTasks, total: openTasks.length + doneTasks.length };
  }, [data.enrichedComments]);

  useEffect(() => {
    if (!selectedComment) return;
    const tasks = data.tasksByComment.get(selectedComment.id) ?? [];
    if (JSON.stringify(selectedComment.tasks) !== JSON.stringify(tasks)) {
      setSelectedComment((prev) => prev ? { ...prev, tasks } : prev);
    }
  }, [data.tasksByComment, selectedComment]);

  useEffect(() => {
    if (!taskingComment) return;
    const tasks = data.tasksByComment.get(taskingComment.id) ?? [];
    if (JSON.stringify(taskingComment.tasks) !== JSON.stringify(tasks)) {
      setTaskingComment((prev) => prev ? { ...prev, tasks } : prev);
    }
  }, [data.tasksByComment, taskingComment]);

  if (!data.project && !data.loading) return null;

  return (
    <div className="flex flex-col h-full">
      {data.project && (
        <FeedbackProjectHeader
          projectId={projectId}
          project={data.project}
          setProject={data.setProject}
          customDomain={data.customDomain}
          hasWebpages={hasWebpages}
          activeTab="comments"
          onAddItem={() => setShowAddItem(true)}
        />
      )}

      {showAddItem && data.project && session?.user?.id && (
        <AddFeedbackItemModal
          reviewProjectId={data.project.id}
          companyId={companyId}
          userId={session.user.id}
          nextSortOrder={data.items.length}
          onClose={() => setShowAddItem(false)}
          onSuccess={() => { data.fetchData(); }}
        />
      )}

      <div className="flex-1 px-6 lg:px-10 pb-8 pt-6 overflow-hidden">
        {data.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : data.enrichedComments.length === 0 && data.completions.length === 0 ? (
          <div className="space-y-4">
            <GeneralCommentComposer onSubmit={actions.handleSubmitGeneralComment} />
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
            <div className={`min-w-0 overflow-y-auto space-y-4 px-1 ${showTasks ? 'hidden lg:block lg:w-[55%]' : 'w-full lg:w-[55%]'}`}>
              <GeneralCommentComposer onSubmit={actions.handleSubmitGeneralComment} />

              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
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
                        onToggleResolve={() => actions.handleToggleResolve(comment, !comment.resolved)}
                        onOpenTasks={() => setTaskingComment(comment)}
                        memberNameMap={data.memberNameMap}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

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
                        memberNameMap={data.memberNameMap}
                        onToggleComplete={() => actions.toggleTaskComplete(task.comment_id, task.id, true)}
                        onViewComment={() => {
                          const c = data.enrichedComments.find((ec) => ec.id === task.comment_id);
                          if (c) setSelectedTaskDetail({ task, comment: c });
                        }}
                      />
                    ))}
                    {allProjectTasks.doneTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        memberNameMap={data.memberNameMap}
                        onToggleComplete={() => actions.toggleTaskComplete(task.comment_id, task.id, false)}
                        onViewComment={() => {
                          const c = data.enrichedComments.find((ec) => ec.id === task.comment_id);
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

      {selectedComment && (
        <FeedbackModal
          comment={selectedComment}
          allComments={data.allComments}
          onClose={() => setSelectedComment(null)}
          onToggleResolve={actions.handleToggleResolve}
          onSubmitReply={actions.handleSubmitReply}
          onDelete={actions.handleDeleteComment}
          memberNameMap={data.memberNameMap}
          currentMemberId={currentMemberId}
          onOpenTasks={() => { setTaskingComment(selectedComment); }}
          onQuickAssign={(memberId, instructions) => actions.quickAssign(selectedComment.id, memberId, instructions)}
          onToggleTaskComplete={actions.toggleTaskComplete}
          onRemoveTask={actions.removeTask}
          onPriorityChange={actions.changePriority}
          onOpenTaskDetail={(task) => setSelectedTaskDetail({ task, comment: selectedComment })}
          teamMembers={data.teamMembers}
          projectId={projectId}
          participantsUrl={`/api/campaigns/${projectId}/participants?company_id=${companyId}`}
        />
      )}

      {taskingComment && (
        <TaskModal
          commentId={taskingComment.id}
          commentContent={taskingComment.content || ''}
          companyId={companyId}
          currentMemberId={currentMemberId}
          existingTasks={taskingComment.tasks ?? []}
          teamMembers={data.teamMembers}
          memberNameMap={data.memberNameMap}
          onCreateTask={actions.createTask}
          onToggleComplete={actions.toggleTaskComplete}
          onRemoveTask={actions.removeTask}
          onClose={() => setTaskingComment(null)}
        />
      )}

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
          memberNameMap={data.memberNameMap}
          teamMembers={data.teamMembers}
          existingTasks={selectedTaskDetail.comment.tasks ?? []}
          onToggleComplete={actions.toggleTaskComplete}
          onRemoveTask={actions.removeTask}
          onCreateTask={actions.createTask}
          onClose={() => setSelectedTaskDetail(null)}
        />
      )}
    </div>
  );
}
