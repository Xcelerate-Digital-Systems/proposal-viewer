'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  supabase,
  type FeedbackItem,
  type FeedbackProject,
  type FeedbackBoardEdge,
  type FeedbackBoardNote,
  type FeedbackBoardShape,
} from '@/lib/supabase';
import type { CommentStats } from './FeedbackBoardContext';

export function useBoardData(projectId: string, companyId: string) {
  const router = useRouter();

  const [project, setProjectState] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [boardEdges, setBoardEdges] = useState<FeedbackBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<FeedbackBoardNote[]>([]);
  const [shapes, setShapes] = useState<FeedbackBoardShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [commentStats, setCommentStats] = useState<Map<string, CommentStats>>(new Map());

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();
    if (error || !data) {
      router.push('/campaigns');
      return;
    }

    let project = data;
    if (!project.board_share_token) {
      const newToken = crypto.randomUUID();
      const { data: updated } = await supabase
        .from('review_projects')
        .update({ board_share_token: newToken, updated_at: new Date().toISOString() })
        .eq('id', project.id)
        .select()
        .single();
      if (updated) project = updated;
    }

    setProjectState(project);
  }, [projectId, companyId, router]);

  const refreshItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });
    setItems(data || []);
  }, [projectId]);

  const loadBoardEdges = useCallback(async () => {
    const { data } = await supabase
      .from('review_board_edges')
      .select('*')
      .eq('review_project_id', projectId);
    setBoardEdges(data || []);
  }, [projectId]);

  const loadBoardNotes = useCallback(async () => {
    const { data } = await supabase
      .from('review_board_notes')
      .select('*')
      .eq('review_project_id', projectId);
    setBoardNotes(data || []);
  }, [projectId]);

  const loadShapes = useCallback(async () => {
    const { data } = await supabase
      .from('review_board_shapes')
      .select('*')
      .eq('review_project_id', projectId);
    setShapes(data || []);
  }, [projectId]);

  const loadCommentStats = useCallback(async () => {
    const { data } = await supabase
      .from('review_comments')
      .select('review_item_id, resolved')
      .eq('review_project_id', projectId)
      .is('parent_comment_id', null);
    if (!data) return;
    const stats = new Map<string, CommentStats>();
    for (const row of data) {
      const id = row.review_item_id;
      const existing = stats.get(id) || { total: 0, unresolved: 0 };
      existing.total++;
      if (!row.resolved) existing.unresolved++;
      stats.set(id, existing);
    }
    setCommentStats(stats);
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
    Promise.all([
      fetchProject(),
      refreshItems(),
      loadBoardEdges(),
      loadBoardNotes(),
      loadShapes(),
      fetchCustomDomain(),
      loadCommentStats(),
    ]).finally(() => setLoading(false));
  }, [fetchProject, refreshItems, loadBoardEdges, loadBoardNotes, loadShapes, fetchCustomDomain, loadCommentStats]);

  return {
    project,
    setProjectState,
    items,
    setItems,
    boardEdges,
    setBoardEdges,
    boardNotes,
    setBoardNotes,
    shapes,
    setShapes,
    loading,
    customDomain,
    commentStats,
    refreshItems,
    loadBoardEdges,
    loadShapes,
  };
}
