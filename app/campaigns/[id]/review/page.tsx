'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import FeedbackDetailView from '@/components/feedback/FeedbackDetailView';
import AddVersionModal from '@/components/admin/feedback/AddVersionModal';
import TaskModal from '@/components/admin/feedback/feedback-list/TaskModal';
import TaskDetailModal from '@/components/admin/feedback/feedback-list/TaskDetailModal';
import ShareMenu from '@/components/feedback/ShareMenu';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackCommentReaction } from '@/lib/supabase';
import type { FeedbackStatus, FeedbackItemVersion, CommentTask, FeedbackCommentPriority, FeedbackCommentAttachment, CommentTaskAttachment } from '@/lib/types/feedback';
import { DEFAULT_SHARED_VIEWS } from '@/lib/types/feedback';
import { REVIEW_STATUS_OPTIONS } from '@/lib/feedback/status';
import { buildReviewProjectUrl } from '@/lib/proposal-url';
import { useItemVersions } from '@/hooks/useItemVersions';
import { applyVersion, getActiveVersion } from '@/lib/feedback/versions';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import { authFetch } from '@/lib/auth-fetch';

const projectStatusOptions: StatusOption<FeedbackStatus>[] = REVIEW_STATUS_OPTIONS.map((s) => ({
  value: s.value, label: s.label, bg: s.bg, text: s.text, border: s.border, icon: s.icon,
}));

export default function StandaloneAssetReviewPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <AssetReviewGate
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

function AssetReviewGate(props: {
  accountType?: 'agency' | 'client';
  projectId: string;
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
  return <AssetReviewContent {...props} />;
}

function AssetReviewContent({
  projectId,
  companyId,
  session,
  teamMember,
}: {
  projectId: string;
  companyId: string;
  session: { user: { id: string; email?: string } } | null;
  teamMember: { id?: string; name?: string; email?: string; avatar_path?: string | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [allProjectComments, setAllProjectComments] = useState<Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved' | 'thread_number'>[]>([]);
  const [reactions, setReactions] = useState<FeedbackCommentReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null | undefined>(undefined);
  const [reviewMode, setReviewMode] = useState<'comment' | 'browse'>('comment');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [taskingCommentId, setTaskingCommentId] = useState<string | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<{ task: CommentTask; comment: FeedbackComment } | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [memberNameMap, setMemberNameMap] = useState<Record<string, string>>({});
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const authorName = teamMember?.name || teamMember?.email || 'Team';

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!teamMember?.avatar_path) return;
    supabase.storage
      .from('proposals')
      .createSignedUrl(teamMember.avatar_path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setAvatarUrl(data.signedUrl); });
  }, [teamMember?.avatar_path]);

  const currentItem = items[0] ?? null;
  const itemId = currentItem?.id ?? '';

  const { versions, activeVersionId, setActiveVersion, createVersion, updateVersion, uploadAsset: uploadVersionAsset, creating: creatingVersion } = useItemVersions({ item: currentItem, companyId, userId: session?.user?.id ?? null });
  const supportsVersions = currentItem?.type !== 'webpage';
  const mergedItem = currentItem ? applyVersion(currentItem, getActiveVersion(versions, activeVersionId)) : null;

  // Fetch project + item + branding
  useEffect(() => {
    (async () => {
      const [projRes, itemsRes, brandRes, domainRes, membersRes] = await Promise.all([
        supabase.from('review_projects').select('*').eq('id', projectId).eq('company_id', companyId).single(),
        supabase.from('review_items').select('*').eq('review_project_id', projectId).eq('company_id', companyId).order('sort_order').limit(1),
        supabase.from('companies').select('branding').eq('id', companyId).single(),
        supabase.from('companies').select('custom_domain, domain_verified').eq('id', companyId).single(),
        supabase.from('team_members').select('id, name, email').eq('company_id', companyId),
      ]);

      if (!projRes.data || !itemsRes.data?.length) {
        router.replace('/campaigns');
        return;
      }

      setProject(projRes.data as FeedbackProject);
      setItems(itemsRes.data as FeedbackItem[]);

      if (brandRes.data?.branding) {
        setBranding({ ...DEFAULT_BRANDING, ...brandRes.data.branding });
      }
      setBrandingLoaded(true);

      if (domainRes.data?.domain_verified && domainRes.data.custom_domain) {
        setCustomDomain(domainRes.data.custom_domain);
      }

      if (membersRes.data) {
        setTeamMembers(membersRes.data);
        const map: Record<string, string> = {};
        membersRes.data.forEach((m) => { map[m.id] = m.name || m.email; });
        setMemberNameMap(map);
      }

      // Fetch comments for the single item
      const theItem = itemsRes.data[0];
      const [commentsRes, reactionsRes] = await Promise.all([
        supabase.from('review_comments').select('*').or(`review_item_id.eq.${theItem.id},review_project_id.eq.${projectId}`).order('created_at'),
        supabase.from('review_comment_reactions').select('*').eq('review_item_id', theItem.id),
      ]);

      if (commentsRes.data) {
        const enriched = await enrichComments(commentsRes.data);
        setComments(enriched);
        setAllProjectComments(enriched.map((c) => ({
          id: c.id, review_item_id: c.review_item_id, parent_comment_id: c.parent_comment_id,
          resolved: c.resolved, thread_number: c.thread_number,
        })));
      }
      if (reactionsRes.data) setReactions(reactionsRes.data);

      setLoading(false);
    })();
  }, [projectId, companyId, router]);

  // Comment actions — adapter matching onSubmitComment prop signature
  const submitComment = useCallback(async (
    reviewItemId: string, content: string, pinX?: number, pinY?: number,
    parentId?: string, annotationData?: unknown, screenshotUrl?: string,
    highlightData?: { text: string; start: number; end: number; elementPath: string },
    priority?: FeedbackCommentPriority, attachments?: FeedbackCommentAttachment[],
    videoUrl?: string | null,
  ) => {
    const commentType = pinX != null ? 'pin' : highlightData ? 'text_highlight' : 'general';

    const { data, error } = await supabase
      .from('review_comments')
      .insert({
        review_item_id: reviewItemId || itemId,
        review_project_id: projectId,
        company_id: companyId,
        content,
        comment_type: commentType,
        pin_x: pinX,
        pin_y: pinY,
        parent_comment_id: parentId ?? null,
        annotation_data: annotationData ? annotationData as Record<string, unknown> : null,
        screenshot_url: screenshotUrl ?? null,
        video_url: videoUrl ?? null,
        highlight_text: highlightData?.text ?? null,
        highlight_start: highlightData?.start ?? null,
        highlight_end: highlightData?.end ?? null,
        highlight_element_path: highlightData?.elementPath ?? null,
        attachments: attachments ?? null,
        priority: priority ?? null,
        author_name: authorName,
        author_email: teamMember?.email ?? '',
        author_user_id: session?.user?.id ?? null,
        author_type: 'team',
        version_id: activeVersionId,
      })
      .select('*')
      .single();

    if (error || !data) { toast.error('Failed to post comment'); return; }
    const enriched = await enrichComments([data]);
    setComments((prev) => [...prev, ...enriched]);
    setAllProjectComments((prev) => [...prev, ...enriched.map((c) => ({
      id: c.id, review_item_id: c.review_item_id, parent_comment_id: c.parent_comment_id,
      resolved: c.resolved, thread_number: c.thread_number,
    }))]);
  }, [itemId, projectId, companyId, authorName, teamMember, session, activeVersionId, toast]);

  const resolveComment = useCallback(async (commentId: string) => {
    await supabase.from('review_comments').update({ resolved: true, resolved_by: authorName, resolved_at: new Date().toISOString() }).eq('id', commentId);
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, resolved: true, resolved_by: authorName, resolved_at: new Date().toISOString() } : c));
    setAllProjectComments((prev) => prev.map((c) => c.id === commentId ? { ...c, resolved: true } : c));
  }, [authorName]);

  const unresolveComment = useCallback(async (commentId: string) => {
    await supabase.from('review_comments').update({ resolved: false, resolved_by: null, resolved_at: null }).eq('id', commentId);
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, resolved: false, resolved_by: null, resolved_at: null } : c));
    setAllProjectComments((prev) => prev.map((c) => c.id === commentId ? { ...c, resolved: false } : c));
  }, []);

  const editComment = useCallback(async (commentId: string, content: string) => {
    await supabase.from('review_comments').update({ content, updated_at: new Date().toISOString() }).eq('id', commentId);
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, content } : c));
  }, []);

  const deleteComment = useCallback(async (commentId: string) => {
    await supabase.from('review_comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId));
    setAllProjectComments((prev) => prev.filter((c) => c.id !== commentId));
  }, []);

  const updateItemStatus = useCallback(async (theItemId: string, status: FeedbackStatus) => {
    await supabase.from('review_items').update({ status, updated_at: new Date().toISOString() }).eq('id', theItemId);
    setItems((prev) => prev.map((i) => i.id === theItemId ? { ...i, status } : i));
  }, []);

  const quickAssign = useCallback(async (commentId: string, memberId: string, instructions: string) => {
    const { data } = await supabase.from('review_comment_tasks').insert({
      review_comment_id: commentId, assignee_id: memberId, instructions: instructions || '',
      created_by: session?.user?.id ?? null,
    }).select('*').single();
    if (data) {
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, tasks: [...(c.tasks ?? []), data] } : c));
    }
  }, [session]);

  const toggleTaskComplete = useCallback(async (commentId: string, taskId: string, complete: boolean) => {
    await supabase.from('review_comment_tasks').update({
      completed: complete, completed_at: complete ? new Date().toISOString() : null,
    }).eq('id', taskId);
    setComments((prev) => prev.map((c) => ({
      ...c, tasks: (c.tasks ?? []).map((t) => t.id === taskId ? { ...t, completed: complete, completed_at: complete ? new Date().toISOString() : null } : t),
    })));
  }, []);

  const removeTask = useCallback(async (commentId: string, taskId: string) => {
    await supabase.from('review_comment_tasks').delete().eq('id', taskId);
    setComments((prev) => prev.map((c) => ({ ...c, tasks: (c.tasks ?? []).filter((t) => t.id !== taskId) })));
  }, []);

  const createTask = useCallback(async (commentId: string, memberId: string, instructions: string, attachments: CommentTaskAttachment[]) => {
    const { data } = await supabase.from('review_comment_tasks').insert({
      review_comment_id: commentId, assignee_id: memberId, instructions,
      attachments: attachments.length > 0 ? attachments : null,
      created_by: session?.user?.id ?? null,
    }).select('*').single();
    if (data) {
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, tasks: [...(c.tasks ?? []), data] } : c));
    }
  }, [session]);

  // Figma sync
  const [syncing, setSyncing] = useState(false);
  const handleFigmaSync = useCallback(async (item: FeedbackItem) => {
    setSyncing(true);
    try {
      const res = await authFetch('/api/connectors/figma/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewItemId: item.id }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Sync failed'); setSyncing(false); return; }
      toast.success(`Synced — v${json.data.versionNumber} created`);
      window.location.reload();
    } catch { toast.error('Failed to sync from Figma'); }
    setSyncing(false);
  }, [toast]);

  const renderHeaderActions = useCallback((ci: FeedbackItem | null) => {
    if (!ci || ci.type !== 'figma') return null;
    return (
      <Button variant="outline" size="sm" onClick={() => handleFigmaSync(ci)} disabled={syncing}>
        {syncing ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <RefreshCw size={13} className="mr-1.5" />}
        Sync from Figma
      </Button>
    );
  }, [syncing, handleFigmaSync]);

  const handleProjectStatusChange = async (newStatus: FeedbackStatus) => {
    if (!project) return;
    const { error } = await supabase
      .from('review_projects')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    if (error) { toast.error('Failed to update status'); return; }
    setProject((prev) => prev ? { ...prev, status: newStatus } : prev);
  };

  if (!brandingLoaded || loading || !project) {
    const accent = branding.accent_color || '#017C87';
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${accent}33`, borderTopColor: accent }} />
      </div>
    );
  }

  const buildUrl = (t: string) => buildReviewProjectUrl(t, customDomain, typeof window !== 'undefined' ? window.location.origin : '');

  return (
    <>
      {/* Simplified header for standalone assets */}
      <div className="sticky top-0 z-10 bg-white border-b border-edge px-6 lg:px-10 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <Link href="/campaigns" className="text-faint hover:text-prose transition-colors shrink-0" title="All Campaigns">
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[17px] font-semibold tracking-tight text-ink font-[family-name:var(--font-display)] truncate">
                  {project.title}
                </h1>
                <StatusDropdown value={project.status} options={projectStatusOptions} onChange={handleProjectStatusChange} variant="compact" fullWidth={false} />
              </div>
              {(project.client_company || project.client_name) && (
                <p className="text-xs text-faint truncate">{project.client_company || project.client_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ShareMenu
              projectId={project.id}
              shareToken={project.share_token}
              sharedViews={project.shared_views ?? DEFAULT_SHARED_VIEWS}
              buildUrl={buildUrl}
              onViewsChange={(next) => setProject((prev) => prev ? { ...prev, shared_views: next } : prev)}
              hasPassword={!!project.share_password_hash}
              expiresAt={project.share_expires_at}
              onSecurityChange={({ hasPassword, expiresAt: ea }) =>
                setProject((prev) => prev ? {
                  ...prev,
                  share_password_hash: hasPassword ? (prev.share_password_hash || 'set') : null,
                  share_expires_at: ea,
                } : prev)
              }
            />
          </div>
        </div>
      </div>

      <FeedbackDetailView
        mode="admin"
        project={project}
        items={items}
        comments={comments}
        branding={branding}
        allProjectComments={allProjectComments}
        initialItemId={itemId}
        initialTypeFilter={null}
        authorName={authorName}
        onSubmitComment={submitComment}
        onResolveComment={resolveComment}
        onUnresolveComment={unresolveComment}
        onEditComment={editComment}
        onDeleteComment={deleteComment}
        onOpenTasks={(cId) => setTaskingCommentId(cId)}
        onQuickAssign={quickAssign}
        onToggleTaskComplete={toggleTaskComplete}
        onRemoveTask={removeTask}
        currentMemberId={teamMember?.id ?? null}
        onOpenTaskDetail={(commentId, task) => {
          const c = comments.find((x) => x.id === commentId);
          if (c) setSelectedTaskDetail({ task, comment: c });
        }}
        shareToken={project.share_token || ''}
        companyId={companyId}
        versions={supportsVersions ? versions : undefined}
        activeVersionId={activeVersionId}
        onVersionChange={supportsVersions ? setActiveVersion : undefined}
        onAddVersion={supportsVersions ? () => setShowAddVersion(true) : undefined}
        onEditVersion={supportsVersions ? (versionId) => setEditingVersionId(versionId) : undefined}
        renderHeaderActions={renderHeaderActions}
        onUpdateItemStatus={updateItemStatus}
        browseMode={reviewMode === 'browse'}
        reviewMode={reviewMode}
        onReviewModeChange={setReviewMode}
        reviewerName={authorName}
        reviewerAvatarUrl={avatarUrl}
        reviewerEmail={teamMember?.email || ''}
        reviewSubmitted={reviewSubmitted}
        onReviewSubmitted={() => setReviewSubmitted(true)}
        singleItemOnly
        hideFilterBar
      />

      {showAddVersion && mergedItem && (
        <AddVersionModal
          item={mergedItem}
          nextVersionNumber={versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1}
          creating={creatingVersion}
          onClose={() => setShowAddVersion(false)}
          onSubmit={createVersion}
          onUploadAsset={uploadVersionAsset}
        />
      )}

      {taskingCommentId && (() => {
        const c = comments.find((x) => x.id === taskingCommentId);
        if (!c) return null;
        return (
          <TaskModal
            commentId={c.id} commentContent={c.content} companyId={companyId}
            currentMemberId={teamMember?.id ?? null} existingTasks={c.tasks ?? []}
            teamMembers={teamMembers} memberNameMap={memberNameMap}
            onCreateTask={createTask} onToggleComplete={toggleTaskComplete}
            onRemoveTask={removeTask} onClose={() => setTaskingCommentId(null)}
          />
        );
      })()}

      {selectedTaskDetail && (() => {
        const c = selectedTaskDetail.comment;
        return (
          <TaskDetailModal
            task={selectedTaskDetail.task} commentContent={c.content || ''}
            commentAuthorName={c.author_name} commentCreatedAt={c.created_at}
            commentScreenshotUrl={c.screenshot_url} commentVideoUrl={c.video_url}
            commentThreadNumber={c.thread_number} itemTitle={currentItem?.title}
            itemType={currentItem?.type} projectId={projectId} reviewItemId={currentItem?.id}
            companyId={companyId} currentMemberId={teamMember?.id ?? null}
            memberNameMap={memberNameMap} teamMembers={teamMembers}
            existingTasks={c.tasks ?? []} onToggleComplete={toggleTaskComplete}
            onRemoveTask={removeTask} onCreateTask={createTask}
            onClose={() => setSelectedTaskDetail(null)}
          />
        );
      })()}
    </>
  );
}

async function enrichComments(raw: FeedbackComment[]): Promise<FeedbackComment[]> {
  const commentIds = raw.map((c) => c.id);
  if (!commentIds.length) return raw;

  const { data: tasks } = await supabase
    .from('review_comment_tasks')
    .select('*')
    .in('review_comment_id', commentIds);

  const taskMap = new Map<string, CommentTask[]>();
  (tasks ?? []).forEach((t) => {
    const arr = taskMap.get(t.review_comment_id) ?? [];
    arr.push(t);
    taskMap.set(t.review_comment_id, arr);
  });

  return raw.map((c) => ({ ...c, tasks: taskMap.get(c.id) ?? [] }));
}
