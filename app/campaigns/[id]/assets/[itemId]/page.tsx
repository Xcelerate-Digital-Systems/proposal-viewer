'use client';

import { useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import type { FeedbackItem, FeedbackStatus, FeedbackItemVersion } from '@/lib/supabase';
import type { CommentTask } from '@/lib/types/feedback';
import TaskModal from '@/components/admin/feedback/feedback-list/TaskModal';
import TaskDetailModal from '@/components/admin/feedback/feedback-list/TaskDetailModal';
import AdminLayout from '@/components/admin/AdminLayout';
import { useToast } from '@/components/ui/Toast';
import FeedbackDetailView from '@/components/feedback/FeedbackDetailView';
import AddVersionModal from '@/components/admin/feedback/AddVersionModal';
import type { VersionView } from '@/lib/feedback/versions';
import { useItemViewerData } from './useItemViewerData';
import { useItemViewerActions } from './useItemViewerActions';


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
  teamMember: { id?: string; name?: string; email?: string; avatar_path?: string | null } | null;
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
/*  Main content — delegates data + actions to extracted hooks         */
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
  teamMember: { id?: string; name?: string; email?: string; avatar_path?: string | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const data = useItemViewerData(projectId, itemId, companyId, session, teamMember);

  const actions = useItemViewerActions({
    projectId,
    itemId,
    companyId,
    session,
    teamMember,
    project: data.project,
    items: data.items,
    comments: data.comments,
    allProjectComments: data.allProjectComments,
    activeVersionId: data.activeVersionId,
    authorName: data.authorName,
    toast,
    setComments: data.setComments,
    setAllProjectComments: data.setAllProjectComments,
    setItems: data.setItems,
    setReactions: data.setReactions,
  });

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

  // ── Loading ──
  // Wait for branding before painting anything so we don't flash the default
  // teal accent before the agency's brand color settles in.
  if (!data.brandingLoaded || data.loading || !data.project) {
    const accent = data.branding.accent_color || '#017C87';
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
        project={data.project}
        items={data.items}
        comments={data.comments}
        branding={data.branding}
        allProjectComments={data.allProjectComments}
        initialItemId={itemId}
        initialTypeFilter={data.typeFilter}
        authorName={data.authorName}
        onSubmitComment={actions.submitComment}
        onResolveComment={actions.resolveComment}
        onUnresolveComment={actions.unresolveComment}
        onEditComment={actions.editComment}
        onDeleteComment={actions.deleteComment}
        onOpenTasks={(cId) => data.setTaskingCommentId(cId)}
        onQuickAssign={actions.quickAssign}
        onToggleTaskComplete={actions.toggleTaskComplete}
        onRemoveTask={actions.removeTask}
        currentMemberId={teamMember?.id ?? null}
        onOpenTaskDetail={(commentId, task) => {
          const c = data.comments.find((x) => x.id === commentId);
          if (c) data.setSelectedTaskDetail({ task, comment: c });
        }}
        onItemChange={handleItemChange}
        onFilterChange={handleFilterChange}
        shareToken={data.project.share_token || ''}
        companyId={companyId}
        versions={data.supportsVersions ? data.versions : undefined}
        activeVersionId={data.activeVersionId}
        onVersionChange={data.supportsVersions ? data.setActiveVersion : undefined}
        onAddVersion={data.supportsVersions ? () => data.setShowAddVersion(true) : undefined}
        onEditVersion={
          data.supportsVersions
            ? (versionId) => data.setEditingVersionId(versionId)
            : undefined
        }
        backAction={{
          label: data.project.title || 'Back',
          onClick: () => router.push(`/campaigns/${projectId}/assets${data.typeFilter ? `?type=${data.typeFilter}` : ''}`),
        }}
        onUpdateItemStatus={actions.updateItemStatus}
        browseMode={data.reviewMode === 'browse'}
        reviewMode={data.reviewMode}
        onReviewModeChange={data.setReviewMode}
        reviewerName={data.authorName}
        reviewerAvatarUrl={data.avatarUrl}
        reviewerEmail={teamMember?.email || ''}
        reviewSubmitted={data.reviewSubmitted}
        onReviewSubmitted={() => data.setReviewSubmitted(true)}
      />

      {data.showAddVersion && data.mergedItem && (
        <AddVersionModal
          item={data.mergedItem}
          nextVersionNumber={data.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1}
          creating={data.creatingVersion}
          onClose={() => data.setShowAddVersion(false)}
          onSubmit={data.createVersion}
          onUploadAsset={data.uploadAsset}
        />
      )}

      {data.taskingCommentId && (() => {
        const c = data.comments.find((x) => x.id === data.taskingCommentId);
        if (!c) return null;
        return (
          <TaskModal
            commentId={c.id}
            commentContent={c.content}
            companyId={companyId}
            currentMemberId={teamMember?.id ?? null}
            existingTasks={c.tasks ?? []}
            teamMembers={data.teamMembers}
            memberNameMap={data.memberNameMap}
            onCreateTask={actions.createTask}
            onToggleComplete={actions.toggleTaskComplete}
            onRemoveTask={actions.removeTask}
            onClose={() => data.setTaskingCommentId(null)}
          />
        );
      })()}

      {data.selectedTaskDetail && (() => {
        const c = data.selectedTaskDetail.comment;
        return (
          <TaskDetailModal
            task={data.selectedTaskDetail.task}
            commentContent={c.content || ''}
            commentAuthorName={c.author_name}
            commentCreatedAt={c.created_at}
            commentScreenshotUrl={c.screenshot_url}
            commentVideoUrl={c.video_url}
            commentThreadNumber={c.thread_number}
            itemTitle={data.currentItem?.title}
            itemType={data.currentItem?.type}
            projectId={projectId}
            reviewItemId={data.currentItem?.id}
            companyId={companyId}
            currentMemberId={teamMember?.id ?? null}
            memberNameMap={data.memberNameMap}
            teamMembers={data.teamMembers}
            existingTasks={c.tasks ?? []}
            onToggleComplete={actions.toggleTaskComplete}
            onRemoveTask={actions.removeTask}
            onCreateTask={actions.createTask}
            onClose={() => data.setSelectedTaskDetail(null)}
          />
        );
      })()}

      <EditVersionModalSlot
        editingVersionId={data.editingVersionId}
        versions={data.versions}
        currentItem={data.mergedItem}
        updateVersion={data.updateVersion}
        createVersion={data.createVersion}
        uploadAsset={data.uploadAsset}
        onClose={() => data.setEditingVersionId(undefined)}
      />
    </>
  );
}

function EditVersionModalSlot({
  editingVersionId,
  versions,
  currentItem,
  updateVersion,
  createVersion,
  uploadAsset,
  onClose,
}: {
  editingVersionId: string | null | undefined;
  versions: VersionView[];
  currentItem: FeedbackItem | null;
  updateVersion: (id: string | null, patch: { notes?: string | null; assets: Partial<FeedbackItemVersion> }) => Promise<boolean>;
  createVersion: (data: { notes?: string | null; assets: Partial<FeedbackItemVersion>; resetToStage?: FeedbackStatus | null }) => Promise<FeedbackItemVersion | null>;
  uploadAsset: (file: File) => Promise<string | null>;
  onClose: () => void;
}) {
  if (editingVersionId === undefined || !currentItem) return null;
  const editing = versions.find((v) => (v.id ?? null) === editingVersionId);
  if (!editing) return null;

  return (
    <AddVersionModal
      item={currentItem}
      nextVersionNumber={editing.versionNumber}
      creating={false}
      editingVersion={editing}
      onUpdate={updateVersion}
      onSubmit={createVersion}
      onClose={onClose}
      onUploadAsset={uploadAsset}
    />
  );
}
