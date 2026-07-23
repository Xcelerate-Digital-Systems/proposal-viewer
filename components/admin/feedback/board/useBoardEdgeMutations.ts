'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { supabase, type FeedbackBoardEdge } from '@/lib/supabase';
import type { NewEdge } from './FeedbackBoardContext';
import type { HistoryOp } from './useBoardHistory';

interface UseBoardEdgeMutationsArgs {
  projectId: string;
  companyId: string;
  boardEdges: FeedbackBoardEdge[];
  setBoardEdges: Dispatch<SetStateAction<FeedbackBoardEdge[]>>;
  toast: { error: (msg: string) => void };
  loadBoardEdges: () => Promise<void>;
  recordHistory: (op: HistoryOp) => void;
}

export function useBoardEdgeMutations({
  projectId,
  companyId,
  boardEdges,
  setBoardEdges,
  toast,
  loadBoardEdges,
  recordHistory,
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
      if (data) {
        setBoardEdges((prev) => [...prev, data]);
        const created = data;
        recordHistory({
          label: 'Connect nodes',
          undo: async () => {
            setBoardEdges((prev) => prev.filter((e) => e.id !== created.id));
            await supabase.from('review_board_edges').delete().eq('id', created.id);
          },
          redo: async () => {
            setBoardEdges((prev) => prev.some((e) => e.id === created.id) ? prev : [...prev, created]);
            await supabase.from('review_board_edges').insert(created);
          },
        });
      }
      return data;
    },
    [projectId, companyId, toast, setBoardEdges, recordHistory]
  );

  const updateEdge = useCallback(
    async (id: string, patch: Partial<FeedbackBoardEdge>) => {
      const before = boardEdges.find((e) => e.id === id);
      const beforePatch: Partial<FeedbackBoardEdge> | null = before
        ? Object.keys(patch).reduce<Partial<FeedbackBoardEdge>>((acc, key) => {
            (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
            return acc;
          }, {})
        : null;

      setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      const { error } = await supabase
        .from('review_board_edges')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        toast.error('Failed to update connection');
        loadBoardEdges();
        return;
      }

      if (beforePatch) {
        recordHistory({
          label: 'Edit connection',
          undo: async () => {
            setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...beforePatch } : e)));
            await supabase.from('review_board_edges').update({ ...beforePatch, updated_at: new Date().toISOString() }).eq('id', id);
          },
          redo: async () => {
            setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
            await supabase.from('review_board_edges').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
          },
        });
      }
    },
    [boardEdges, toast, loadBoardEdges, setBoardEdges, recordHistory]
  );

  const deleteEdge = useCallback(
    async (id: string) => {
      const before = boardEdges.find((e) => e.id === id);
      setBoardEdges((prev) => prev.filter((e) => e.id !== id));
      await supabase.from('review_board_edges').delete().eq('id', id);
      if (before) {
        recordHistory({
          label: 'Delete connection',
          undo: async () => {
            setBoardEdges((prev) => prev.some((e) => e.id === before.id) ? prev : [...prev, before]);
            await supabase.from('review_board_edges').insert(before);
          },
          redo: async () => {
            setBoardEdges((prev) => prev.filter((e) => e.id !== id));
            await supabase.from('review_board_edges').delete().eq('id', id);
          },
        });
      }
    },
    [boardEdges, setBoardEdges, recordHistory]
  );

  return { createEdge, updateEdge, deleteEdge };
}
