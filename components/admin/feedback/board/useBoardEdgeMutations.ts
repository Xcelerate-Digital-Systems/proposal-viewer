'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { supabase, type FeedbackBoardEdge } from '@/lib/supabase';
import type { NewEdge } from './FeedbackBoardContext';

interface UseBoardEdgeMutationsArgs {
  projectId: string;
  companyId: string;
  setBoardEdges: Dispatch<SetStateAction<FeedbackBoardEdge[]>>;
  toast: { error: (msg: string) => void };
  loadBoardEdges: () => Promise<void>;
}

export function useBoardEdgeMutations({
  projectId,
  companyId,
  setBoardEdges,
  toast,
  loadBoardEdges,
}: UseBoardEdgeMutationsArgs) {
  const createEdge = useCallback(
    async (edge: NewEdge): Promise<FeedbackBoardEdge | null> => {
      const { data, error } = await supabase
        .from('review_board_edges')
        .insert({ ...edge, review_project_id: projectId, company_id: companyId })
        .select()
        .single();
      if (error) {
        toast.error('Failed to create connection');
        return null;
      }
      if (data) setBoardEdges((prev) => [...prev, data]);
      return data;
    },
    [projectId, companyId, toast, setBoardEdges]
  );

  const updateEdge = useCallback(
    async (id: string, patch: Partial<FeedbackBoardEdge>) => {
      setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      const { error } = await supabase
        .from('review_board_edges')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        toast.error('Failed to update connection');
        loadBoardEdges();
      }
    },
    [toast, loadBoardEdges, setBoardEdges]
  );

  const deleteEdge = useCallback(
    async (id: string) => {
      setBoardEdges((prev) => prev.filter((e) => e.id !== id));
      await supabase.from('review_board_edges').delete().eq('id', id);
    },
    [setBoardEdges]
  );

  return { createEdge, updateEdge, deleteEdge };
}
