'use client';

import { useCallback } from 'react';
import { supabase, type FunnelBoardSection } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import type { HistoryOp } from '@/components/admin/feedback/board/useBoardHistory';

export type NewSection = Omit<
  FunnelBoardSection,
  'id' | 'funnel_id' | 'company_id' | 'tab_id' | 'created_at' | 'updated_at'
>;

interface Deps {
  funnelId: string;
  companyId: string;
  activeTabId: string | null;
  sections: FunnelBoardSection[];
  setSections: React.Dispatch<React.SetStateAction<FunnelBoardSection[]>>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
  recordHistory: (op: HistoryOp) => void;
  loadSections: () => Promise<void>;
}

/** CRUD for labelled background regions. Mirrors useFunnelShapeMutations —
 *  optimistic local update, then persist, with undo/redo recorded. */
export function useFunnelSectionMutations(deps: Deps) {
  const toast = useToast();
  const {
    funnelId, companyId, activeTabId, sections, setSections,
    markSaving, markDone, recordHistory, loadSections,
  } = deps;

  const createSection = useCallback(async (section: NewSection): Promise<FunnelBoardSection | null> => {
    markSaving();
    const { data, error } = await supabase
      .from('funnel_board_sections')
      .insert({ ...section, funnel_id: funnelId, company_id: companyId, tab_id: activeTabId })
      .select().single();
    markDone(!error);
    if (error) { toast.error('Failed to create section'); return null; }
    if (data) {
      setSections((prev) => [...prev, data]);
      const created = data;
      recordHistory({
        label: 'Add section',
        undo: async () => {
          setSections((prev) => prev.filter((s) => s.id !== created.id));
          await supabase.from('funnel_board_sections').delete().eq('id', created.id);
        },
        redo: async () => {
          setSections((prev) => prev.some((s) => s.id === created.id) ? prev : [...prev, created]);
          await supabase.from('funnel_board_sections').insert(created);
        },
      });
    }
    return data;
  }, [funnelId, companyId, activeTabId, toast, recordHistory, markSaving, markDone, setSections]);

  const updateSection = useCallback(async (id: string, patch: Partial<FunnelBoardSection>) => {
    const before = sections.find((s) => s.id === id);
    const beforePatch: Partial<FunnelBoardSection> | null = before
      ? Object.keys(patch).reduce<Partial<FunnelBoardSection>>((acc, key) => {
          (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
          return acc;
        }, {})
      : null;

    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    markSaving();
    const { error } = await supabase
      .from('funnel_board_sections')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    markDone(!error);
    if (error) { toast.error('Failed to save section'); loadSections(); return; }

    // Drag and resize fire constantly; only label/colour edits are worth an
    // undo entry, since position is trivially re-draggable.
    const isGeometryOnly = Object.keys(patch).every(
      (k) => k === 'x' || k === 'y' || k === 'width' || k === 'height' || k === 'updated_at'
    );
    if (beforePatch && !isGeometryOnly) {
      recordHistory({
        label: 'Edit section',
        undo: async () => {
          setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...beforePatch } : s)));
          await supabase.from('funnel_board_sections').update({ ...beforePatch, updated_at: new Date().toISOString() }).eq('id', id);
        },
        redo: async () => {
          setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
          await supabase.from('funnel_board_sections').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
        },
      });
    }
  }, [sections, toast, loadSections, markSaving, markDone, setSections, recordHistory]);

  /** Deletes the region only — nodes sitting inside it are untouched, since
   *  membership is positional and nothing references the section. */
  const deleteSection = useCallback(async (id: string) => {
    const before = sections.find((s) => s.id === id);
    setSections((prev) => prev.filter((s) => s.id !== id));
    markSaving();
    await supabase.from('funnel_board_sections').delete().eq('id', id);
    markDone(true);
    if (before) {
      recordHistory({
        label: 'Delete section',
        undo: async () => {
          setSections((prev) => prev.some((s) => s.id === before.id) ? prev : [...prev, before]);
          await supabase.from('funnel_board_sections').insert(before);
        },
        redo: async () => {
          setSections((prev) => prev.filter((s) => s.id !== id));
          await supabase.from('funnel_board_sections').delete().eq('id', id);
        },
      });
    }
  }, [sections, recordHistory, markSaving, markDone, setSections]);

  return { createSection, updateSection, deleteSection };
}
