'use client';

import { useCallback } from 'react';
import { supabase, type FunnelBoardEdge, type FunnelBoardShape } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { HistoryOp } from '@/components/admin/feedback/board/useBoardHistory';
import type { NewShape } from './FunnelBoardContext';

interface Deps {
  funnelId: string;
  companyId: string;
  shapes: FunnelBoardShape[];
  setShapes: React.Dispatch<React.SetStateAction<FunnelBoardShape[]>>;
  boardEdges: FunnelBoardEdge[];
  setBoardEdges: React.Dispatch<React.SetStateAction<FunnelBoardEdge[]>>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
  recordHistory: (op: HistoryOp) => void;
  loadShapes: () => Promise<void>;
}

export function useFunnelShapeMutations(deps: Deps) {
  const toast = useToast();
  const {
    funnelId, companyId, shapes, setShapes,
    boardEdges, setBoardEdges, markSaving, markDone, recordHistory, loadShapes,
  } = deps;

  const createShape = useCallback(async (shape: NewShape): Promise<FunnelBoardShape | null> => {
    markSaving();
    const { data, error } = await supabase
      .from('funnel_board_shapes')
      .insert({ ...shape, funnel_id: funnelId, company_id: companyId })
      .select().single();
    markDone(!error);
    if (error) { toast.error('Failed to create shape'); return null; }
    if (data) {
      setShapes((prev) => [...prev, data]);
      const created = data;
      recordHistory({
        label: `Add ${shape.shape_type}`,
        undo: async () => {
          setShapes((prev) => prev.filter((s) => s.id !== created.id));
          await supabase.from('funnel_board_shapes').delete().eq('id', created.id);
        },
        redo: async () => {
          setShapes((prev) => prev.some((s) => s.id === created.id) ? prev : [...prev, created]);
          await supabase.from('funnel_board_shapes').insert(created);
        },
      });
    }
    return data;
  }, [funnelId, companyId, toast, recordHistory, markSaving, markDone, setShapes]);

  const updateShape = useCallback(async (id: string, patch: Partial<FunnelBoardShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    markSaving();
    const { error } = await supabase
      .from('funnel_board_shapes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    markDone(!error);
    if (error) { toast.error('Failed to save shape'); loadShapes(); }
  }, [toast, loadShapes, markSaving, markDone, setShapes]);

  const deleteShape = useCallback(async (id: string) => {
    const before = shapes.find((s) => s.id === id);
    const incidentEdges = boardEdges.filter((e) => e.source_shape_id === id || e.target_shape_id === id);
    setShapes((prev) => prev.filter((s) => s.id !== id));
    setBoardEdges((prev) => prev.filter((e) => e.source_shape_id !== id && e.target_shape_id !== id));
    markSaving();
    await supabase.from('funnel_board_shapes').delete().eq('id', id);
    markDone(true);
    if (before) {
      recordHistory({
        label: 'Delete shape',
        undo: async () => {
          setShapes((prev) => prev.some((s) => s.id === before.id) ? prev : [...prev, before]);
          await supabase.from('funnel_board_shapes').insert(before);
          if (incidentEdges.length > 0) {
            setBoardEdges((prev) => {
              const known = new Set(prev.map((e) => e.id));
              return [...prev, ...incidentEdges.filter((e) => !known.has(e.id))];
            });
            await supabase.from('funnel_board_edges').insert(incidentEdges);
          }
        },
        redo: async () => {
          setShapes((prev) => prev.filter((s) => s.id !== id));
          setBoardEdges((prev) => prev.filter((e) => e.source_shape_id !== id && e.target_shape_id !== id));
          await supabase.from('funnel_board_shapes').delete().eq('id', id);
        },
      });
    }
  }, [shapes, boardEdges, recordHistory, markSaving, markDone, setShapes, setBoardEdges]);

  return { createShape, updateShape, deleteShape };
}
