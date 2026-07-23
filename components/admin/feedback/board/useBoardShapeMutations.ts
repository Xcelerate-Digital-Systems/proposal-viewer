'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { supabase, type FeedbackBoardShape, type FeedbackBoardEdge } from '@/lib/supabase';
import type { NewShape } from './FeedbackBoardContext';
import type { HistoryOp } from './useBoardHistory';

interface UseBoardShapeMutationsArgs {
  projectId: string;
  companyId: string;
  shapes: FeedbackBoardShape[];
  boardEdges: FeedbackBoardEdge[];
  setShapes: Dispatch<SetStateAction<FeedbackBoardShape[]>>;
  setBoardEdges: Dispatch<SetStateAction<FeedbackBoardEdge[]>>;
  toast: { error: (msg: string) => void; info: (msg: string, opts?: { action?: { label: string; onClick: () => void } }) => void };
  loadShapes: () => Promise<void>;
  recordHistory: (op: HistoryOp) => void;
  undo: () => Promise<void>;
}

export function useBoardShapeMutations({
  projectId,
  companyId,
  shapes,
  boardEdges,
  setShapes,
  setBoardEdges,
  toast,
  loadShapes,
  recordHistory,
  undo,
}: UseBoardShapeMutationsArgs) {
  const createShape = useCallback(
    async (shape: NewShape): Promise<FeedbackBoardShape | null> => {
      const { data, error } = await supabase
        .from('review_board_shapes')
        .insert({ ...shape, review_project_id: projectId, company_id: companyId })
        .select()
        .single();
      if (error) {
        toast.error('Failed to create shape');
        return null;
      }
      if (data) {
        setShapes((prev) => [...prev, data]);
        const created = data;
        recordHistory({
          label: `Add ${shape.shape_type}`,
          undo: async () => {
            setShapes((prev) => prev.filter((s) => s.id !== created.id));
            await supabase.from('review_board_shapes').delete().eq('id', created.id);
          },
          redo: async () => {
            setShapes((prev) => prev.some((s) => s.id === created.id) ? prev : [...prev, created]);
            await supabase.from('review_board_shapes').insert(created);
          },
        });
      }
      return data;
    },
    [projectId, companyId, toast, recordHistory, setShapes]
  );

  const updateShape = useCallback(
    async (id: string, patch: Partial<FeedbackBoardShape>) => {
      const before = shapes.find((s) => s.id === id);
      const beforePatch: Partial<FeedbackBoardShape> | null = before
        ? Object.keys(patch).reduce<Partial<FeedbackBoardShape>>((acc, key) => {
            (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
            return acc;
          }, {})
        : null;

      setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const { error } = await supabase
        .from('review_board_shapes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        toast.error('Failed to update shape');
        loadShapes();
        return;
      }

      if (beforePatch) {
        recordHistory({
          label: 'Edit shape',
          undo: async () => {
            setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...beforePatch } : s)));
            await supabase.from('review_board_shapes').update({ ...beforePatch, updated_at: new Date().toISOString() }).eq('id', id);
          },
          redo: async () => {
            setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
            await supabase.from('review_board_shapes').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
          },
        });
      }
    },
    [shapes, toast, loadShapes, setShapes, recordHistory]
  );

  const deleteShape = useCallback(
    async (id: string) => {
      const before = shapes.find((s) => s.id === id);
      const incidentEdges = boardEdges.filter((e) => e.source_shape_id === id || e.target_shape_id === id);
      setShapes((prev) => prev.filter((s) => s.id !== id));
      setBoardEdges((prev) => prev.filter((e) => e.source_shape_id !== id && e.target_shape_id !== id));
      await supabase.from('review_board_shapes').delete().eq('id', id);
      if (before) {
        toast.info('Shape deleted', { action: { label: 'Undo', onClick: () => void undo() } });
        recordHistory({
          label: 'Delete shape',
          undo: async () => {
            setShapes((prev) => prev.some((s) => s.id === before.id) ? prev : [...prev, before]);
            await supabase.from('review_board_shapes').insert(before);
            if (incidentEdges.length > 0) {
              setBoardEdges((prev) => {
                const known = new Set(prev.map((e) => e.id));
                return [...prev, ...incidentEdges.filter((e) => !known.has(e.id))];
              });
              await supabase.from('review_board_edges').insert(incidentEdges);
            }
          },
          redo: async () => {
            setShapes((prev) => prev.filter((s) => s.id !== id));
            setBoardEdges((prev) => prev.filter((e) => e.source_shape_id !== id && e.target_shape_id !== id));
            await supabase.from('review_board_shapes').delete().eq('id', id);
          },
        });
      }
    },
    [shapes, boardEdges, recordHistory, toast, undo, setShapes, setBoardEdges]
  );

  return { createShape, updateShape, deleteShape };
}
