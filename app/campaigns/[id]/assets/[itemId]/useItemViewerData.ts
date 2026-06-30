import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment, type FeedbackCommentReaction } from '@/lib/supabase';
import type { CommentTask } from '@/lib/types/feedback';
import { useItemVersions } from '@/hooks/useItemVersions';
import { applyVersion, getActiveVersion } from '@/lib/feedback/versions';
import { type CompanyBranding } from '@/hooks/useProposal';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';

export function useItemViewerData(
  projectId: string,
  itemId: string,
  companyId: string,
  session: { user: { id: string; email?: string } } | null,
  teamMember: { id?: string; name?: string; email?: string; avatar_path?: string | null } | null,
) {
  const router = useRouter();

  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null | undefined>(undefined);
  const [allProjectComments, setAllProjectComments] = useState<Pick<FeedbackComment, 'id' | 'review_item_id' | 'parent_comment_id' | 'resolved' | 'thread_number'>[]>([]);
  const [reactions, setReactions] = useState<FeedbackCommentReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [reviewMode, setReviewMode] = useState<'comment' | 'browse'>('comment');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [taskingCommentId, setTaskingCommentId] = useState<string | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<{ task: CommentTask; comment: FeedbackComment } | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [memberNameMap, setMemberNameMap] = useState<Record<string, string>>({});

  const authorName = teamMember?.name || teamMember?.email || 'Team';

  // Resolve avatar signed URL from storage path
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!teamMember?.avatar_path) return;
    supabase.storage
      .from('proposals')
      .createSignedUrl(teamMember.avatar_path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setAvatarUrl(data.signedUrl); });
  }, [teamMember?.avatar_path]);

  // Type filter — read from URL
  const getUrlType = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('type');
  }, []);
  const [typeFilter] = useState<string | null>(getUrlType);

  // ── Fetch data ──
  const fetchProject = useCallback(async () => {
    const { data } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (!data) { router.push('/campaigns'); return; }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });

    // Webpage items live on their own integrated viewer (widget on the real URL),
    // so they must never appear in this feedback detail view — neither in the
    // sidebar nor as the current item. If the requested itemId is a webpage,
    // send the user back to the items listing.
    const all = data || [];
    const currentIsWebpage = all.find((i) => i.id === itemId)?.type === 'webpage';
    if (currentIsWebpage) {
      router.replace(`/campaigns/${projectId}/assets`);
      return;
    }
    setItems(all.filter((i) => i.type !== 'webpage'));
  }, [projectId, itemId, router]);

  const fetchComments = useCallback(async () => {
    // Fetch direct comments on this item
    const { data: directComments } = await supabase
      .from('review_comments')
      .select('*')
      .eq('review_item_id', itemId)
      .order('created_at', { ascending: true });

    let allComments = directComments || [];

    // For Meta Ads: also fetch variation-scoped comments from sibling items.
    // These are comments where ad_copy_variation_id matches one of this
    // item's linked variations but review_item_id is a different item.
    const { data: links } = await supabase
      .from('review_item_ad_variations')
      .select('ad_copy_variation_id')
      .eq('review_item_id', itemId);

    if (links && links.length > 0) {
      const varIds = links.map((l) => l.ad_copy_variation_id);
      const { data: varComments } = await supabase
        .from('review_comments')
        .select('*')
        .in('ad_copy_variation_id', varIds)
        .neq('review_item_id', itemId)
        .order('created_at', { ascending: true });

      if (varComments && varComments.length > 0) {
        // Remap review_item_id so useCommentFilters includes them
        const remapped = varComments.map((c) => ({ ...c, review_item_id: itemId }));
        allComments = [...allComments, ...remapped].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
    }

    setComments(allComments);
    setLoading(false);
  }, [itemId]);

  const fetchAllProjectComments = useCallback(async () => {
    const { data: projectItems } = await supabase
      .from('review_items')
      .select('id')
      .eq('review_project_id', projectId);

    if (!projectItems?.length) return;

    const itemIds = projectItems.map((i) => i.id);
    const { data } = await supabase
      .from('review_comments')
      .select('id, review_item_id, parent_comment_id, resolved, thread_number')
      .in('review_item_id', itemIds);

    setAllProjectComments(data || []);
  }, [projectId]);

  const fetchReactions = useCallback(async () => {
    // Fetch reactions for all comments on this item
    const { data: itemComments } = await supabase
      .from('review_comments')
      .select('id')
      .eq('review_item_id', itemId);

    if (!itemComments?.length) return;

    const commentIds = itemComments.map((c) => c.id);
    const { data } = await supabase
      .from('review_comment_reactions')
      .select('*')
      .in('review_comment_id', commentIds)
      .order('created_at', { ascending: true });

    setReactions(data || []);
  }, [itemId]);

  const fetchBranding = useCallback(async () => {
    if (!companyId) {
      setBrandingLoaded(true);
      return;
    }
    try {
      const res = await fetch(`/api/company/branding?company_id=${companyId}`);
      if (res.ok) setBranding(await res.json());
    } catch {
      // Fall back to DEFAULT_BRANDING — header just stays neutral.
    } finally {
      setBrandingLoaded(true);
    }
  }, [companyId]);

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchComments();
    fetchAllProjectComments();
    fetchReactions();
    fetchBranding();
  }, [fetchProject, fetchItems, fetchComments, fetchAllProjectComments, fetchReactions, fetchBranding]);

  // Fetch team members for task modal
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name, email')
        .eq('company_id', companyId);
      if (!cancelled && data) {
        setTeamMembers(data);
        const map: Record<string, string> = {};
        for (const m of data) map[m.id] = m.name;
        setMemberNameMap(map);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Fetch tasks for all loaded comments
  useEffect(() => {
    if (comments.length === 0) return;
    let cancelled = false;
    (async () => {
      const commentIds = comments.filter((c) => !c.parent_comment_id).map((c) => c.id);
      const { data } = await supabase
        .from('comment_tasks')
        .select('*')
        .in('comment_id', commentIds);
      if (!cancelled && data) {
        const byComment = new Map<string, CommentTask[]>();
        for (const t of data) {
          const arr = byComment.get(t.comment_id) || [];
          arr.push(t as CommentTask);
          byComment.set(t.comment_id, arr);
        }
        setComments((prev) =>
          prev.map((c) => ({ ...c, tasks: byComment.get(c.id) ?? [] }))
        );
      }
    })();
    return () => { cancelled = true; };
  }, [comments.length]);

  // ── Current item + its versions ──
  const currentItem = items.find((i) => i.id === itemId) || null;
  const supportsVersions = currentItem && currentItem.type !== 'webpage';
  const {
    versions, activeVersionId, creating: creatingVersion,
    setActiveVersion, createVersion, updateVersion, uploadAsset,
  } = useItemVersions({
    item: supportsVersions ? currentItem : null,
    companyId,
    userId: session?.user?.id ?? null,
  });

  // Version-merged item: overlays the active version's assets onto the raw
  // item so AddVersionModal seeds from the CURRENT version's copy, not v1.
  const mergedItem = useMemo(() => {
    if (!currentItem || versions.length === 0) return currentItem;
    const active = getActiveVersion(versions, activeVersionId);
    return applyVersion(currentItem, active);
  }, [currentItem, versions, activeVersionId]);

  return {
    project,
    items,
    comments,
    showAddVersion,
    editingVersionId,
    allProjectComments,
    reactions,
    loading,
    branding,
    brandingLoaded,
    reviewMode,
    reviewSubmitted,
    taskingCommentId,
    selectedTaskDetail,
    teamMembers,
    memberNameMap,
    authorName,
    avatarUrl,
    typeFilter,
    currentItem,
    supportsVersions,
    versions,
    activeVersionId,
    creatingVersion,
    mergedItem,
    // Setters
    setComments,
    setAllProjectComments,
    setItems,
    setShowAddVersion,
    setEditingVersionId,
    setReactions,
    setReviewMode,
    setReviewSubmitted,
    setTaskingCommentId,
    setSelectedTaskDetail,
    // Version actions
    setActiveVersion,
    createVersion,
    updateVersion,
    uploadAsset,
  };
}
