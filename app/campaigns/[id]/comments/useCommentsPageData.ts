'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackComment } from '@/lib/supabase';
import type { CommentTask } from '@/lib/types/feedback';
import type { CommentWithItem } from '@/components/admin/feedback/feedback-list/types';
import type { ReviewCompletion, TeamMemberOption } from './comments-types';

/* ------------------------------------------------------------------ */
/*  Hook: data fetching + derived state for the comments page          */
/* ------------------------------------------------------------------ */

export function useCommentsPageData(projectId: string, companyId: string) {
  const router = useRouter();

  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [allComments, setAllComments] = useState<FeedbackComment[]>([]);
  const [allTasks, setAllTasks] = useState<CommentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completions, setCompletions] = useState<ReviewCompletion[]>([]);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [memberNameMap, setMemberNameMap] = useState<Record<string, string>>({});

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

  return {
    project,
    setProject,
    items,
    allComments,
    setAllComments,
    allTasks,
    setAllTasks,
    loading,
    completions,
    customDomain,
    teamMembers,
    memberNameMap,
    tasksByComment,
    enrichedComments,
    fetchData,
  };
}
