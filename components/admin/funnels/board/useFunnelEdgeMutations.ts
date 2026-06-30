'use client';

import { useCallback } from 'react';
import { supabase, type FunnelBoardEdge } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { HistoryOp } from '@/components/admin/feedback/board/useBoardHistory';
import type { NewEdge } from './FunnelBoardContext';

interface Deps {
  funnelId: string;
  companyId: string;
  boardEdges: FunnelBoardEdge[];
  setBoardEdges: React.Dispatch<React.SetStateAction<FunnelBoardEdge[]>>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
  recordHistory: (op: HistoryOp) => void;
  loadEdges: () => Promise<void>;
}

export function useFunnelEdgeMutations(deps: Deps) {
  const toast = useToast();
  const { funnelId, companyId, boardEdges, setBoardEdges, markSaving, markDone, recordHistory, loadEdges } = deps;

  const insertEdgeRow = useCallback(async (row: FunnelBoardEdge) => {
    setBoardEdges((prev) => prev.some((e) => e.id === row.id) ? prev : [...prev, row]);
    await supabase.from('funnel_board_edges').insert(row);
  }, [setBoardEdges]);

  const createEdge = useCallback(async (edge: NewEdge): Promise<FunnelBoardEdge | null> => {
    markSaving();
    const { data, error } = await supabase
      .from('funnel_board_edges')
      .insert({ ...edge, funnel_id: funnelId, company_id: companyId })
      .select().single();
    markDone(!error);
    if (error) { toast.error('Failed to create connection'); return null; }
    if (data) {
      setBoardEdges((prev) => [...prev, data]);
      const created = data as FunnelBoardEdge;
      recordHistory({
        label: 'Connect nodes',
        undo: async () => {
          setBoardEdges((prev) => prev.filter((e) => e.id !== created.id));
          await supabase.from('funnel_board_edges').delete().eq('id', created.id);
        },
        redo: async () => { await insertEdgeRow(created); },
      });
    }
    return data;
  }, [funnelId, companyId, toast, recordHistory, insertEdgeRow, markSaving, markDone, setBoardEdges]);

  const updateEdge = useCallback(async (id: string, patch: Partial<FunnelBoardEdge>) => {
    const before = boardEdges.find((e) => e.id === id);
    const beforePatch: Partial<FunnelBoardEdge> | null = before
      ? Object.keys(patch).reduce<Partial<FunnelBoardEdge>>((acc, key) => {
          (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
          return acc;
        }, {})
      : null;

    setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    markSaving();
    const { error } = await supabase
      .from('funnel_board_edges')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    markDone(!error);
    if (error) { toast.error('Failed to update connection'); loadEdges(); return; }

    if (beforePatch) {
      recordHistory({
        label: 'Edit connection',
        undo: async () => {
          setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...beforePatch } : e)));
          await supabase.from('funnel_board_edges').update({ ...beforePatch, updated_at: new Date().toISOString() }).eq('id', id);
        },
        redo: async () => {
          setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
          await supabase.from('funnel_board_edges').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
        },
      });
    }
  }, [boardEdges, toast, loadEdges, recordHistory, markSaving, markDone, setBoardEdges]);

  const deleteEdge = useCallback(async (id: string) => {
    const before = boardEdges.find((e) => e.id === id);
    setBoardEdges((prev) => prev.filter((e) => e.id !== id));
    markSaving();
    await supabase.from('funnel_board_edges').delete().eq('id', id);
    markDone(true);
    if (before) {
      recordHistory({
        label: 'Delete connection',
        undo: async () => { await insertEdgeRow(before); },
        redo: async () => {
          setBoardEdges((prev) => prev.filter((e) => e.id !== id));
          await supabase.from('funnel_board_edges').delete().eq('id', id);
        },
      });
    }
  }, [boardEdges, recordHistory, insertEdgeRow, markSaving, markDone, setBoardEdges]);

  return { createEdge, updateEdge, deleteEdge };
}
