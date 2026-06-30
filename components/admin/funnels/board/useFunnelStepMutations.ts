'use client';

import { useCallback } from 'react';
import { supabase, type FunnelStep, type FunnelStepType } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { FUNNEL_STEP_DEFAULTS } from '@/lib/types/funnel';
import type { HistoryOp } from '@/components/admin/feedback/board/useBoardHistory';

interface Deps {
  funnelId: string;
  companyId: string;
  steps: FunnelStep[];
  setSteps: React.Dispatch<React.SetStateAction<FunnelStep[]>>;
  setSelectedStepId: React.Dispatch<React.SetStateAction<string | null>>;
  boardEdges: { id: string; source_step_id: string | null; target_step_id: string | null }[];
  setBoardEdges: React.Dispatch<React.SetStateAction<any[]>>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
  recordHistory: (op: HistoryOp) => void;
  loadSteps: () => Promise<void>;
}

export function useFunnelStepMutations(deps: Deps) {
  const toast = useToast();
  const {
    funnelId, companyId, steps, setSteps, setSelectedStepId,
    boardEdges, setBoardEdges, markSaving, markDone, recordHistory, loadSteps,
  } = deps;

  const insertStepRow = useCallback(async (row: FunnelStep) => {
    setSteps((prev) => prev.some((s) => s.id === row.id) ? prev : [...prev, row]);
    await supabase.from('funnel_steps').insert(row);
  }, [setSteps]);

  const createStep = useCallback(
    async (stepType: FunnelStepType, position: { x: number; y: number }): Promise<FunnelStep | null> => {
      const defaults = FUNNEL_STEP_DEFAULTS[stepType];
      markSaving();
      const { data, error } = await supabase
        .from('funnel_steps')
        .insert({
          funnel_id: funnelId,
          company_id: companyId,
          step_type: stepType,
          label: defaults.label,
          icon: defaults.icon,
          url: null,
          color: null,
          board_x: Math.round(position.x),
          board_y: Math.round(position.y),
          metrics: {},
        })
        .select().single();
      markDone(!error);
      if (error || !data) { toast.error('Failed to add step'); return null; }
      setSteps((prev) => [...prev, data]);
      setSelectedStepId(data.id);
      const created: FunnelStep = data;
      recordHistory({
        label: `Add ${defaults.label} step`,
        undo: async () => {
          setSteps((prev) => prev.filter((s) => s.id !== created.id));
          setSelectedStepId((prev) => (prev === created.id ? null : prev));
          await supabase.from('funnel_steps').delete().eq('id', created.id);
        },
        redo: async () => { await insertStepRow(created); },
      });
      return data;
    },
    [funnelId, companyId, toast, recordHistory, insertStepRow, markSaving, markDone, setSteps, setSelectedStepId]
  );

  const updateStep = useCallback(async (id: string, patch: Partial<FunnelStep>) => {
    const before = steps.find((s) => s.id === id);
    const beforePatch: Partial<FunnelStep> | null = before
      ? Object.keys(patch).reduce<Partial<FunnelStep>>((acc, key) => {
          (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
          return acc;
        }, {})
      : null;

    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    markSaving();
    const { error } = await supabase
      .from('funnel_steps')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    markDone(!error);
    if (error) { toast.error('Failed to save step'); loadSteps(); return; }

    if (beforePatch) {
      recordHistory({
        label: 'Edit step',
        undo: async () => {
          setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...beforePatch } : s)));
          await supabase.from('funnel_steps').update({ ...beforePatch, updated_at: new Date().toISOString() }).eq('id', id);
        },
        redo: async () => {
          setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
          await supabase.from('funnel_steps').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
        },
      });
    }
  }, [steps, toast, loadSteps, recordHistory, markSaving, markDone, setSteps]);

  const deleteStep = useCallback(async (id: string) => {
    const before = steps.find((s) => s.id === id);
    const incidentEdges = boardEdges.filter((e) => e.source_step_id === id || e.target_step_id === id);

    setSteps((prev) => prev.filter((s) => s.id !== id));
    setBoardEdges((prev: any[]) => prev.filter((e: any) => e.source_step_id !== id && e.target_step_id !== id));
    setSelectedStepId((prev) => (prev === id ? null : prev));
    markSaving();
    await supabase.from('funnel_steps').delete().eq('id', id);
    markDone(true);

    if (before) {
      recordHistory({
        label: `Delete ${before.label} step`,
        undo: async () => {
          await insertStepRow(before);
          if (incidentEdges.length > 0) {
            setBoardEdges((prev: any[]) => {
              const known = new Set(prev.map((e: any) => e.id));
              return [...prev, ...incidentEdges.filter((e) => !known.has(e.id))];
            });
            await supabase.from('funnel_board_edges').insert(incidentEdges);
          }
        },
        redo: async () => {
          setSteps((prev) => prev.filter((s) => s.id !== id));
          setBoardEdges((prev: any[]) => prev.filter((e: any) => e.source_step_id !== id && e.target_step_id !== id));
          await supabase.from('funnel_steps').delete().eq('id', id);
        },
      });
    }
  }, [steps, boardEdges, recordHistory, insertStepRow, markSaving, markDone, setSteps, setBoardEdges, setSelectedStepId]);

  return { createStep, updateStep, deleteStep };
}
