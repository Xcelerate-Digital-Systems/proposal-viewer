'use client';

import { useCallback } from 'react';
import { supabase, type FunnelTab } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface Deps {
  funnelId: string;
  companyId: string;
  tabs: FunnelTab[];
  setTabs: React.Dispatch<React.SetStateAction<FunnelTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
}

export function useFunnelTabMutations(deps: Deps) {
  const toast = useToast();
  const { funnelId, companyId, tabs, setTabs, setActiveTabId, markSaving, markDone } = deps;

  const createTab = useCallback(async (name?: string): Promise<FunnelTab | null> => {
    const isFirst = tabs.length === 0;
    markSaving();

    const { data, error } = await supabase
      .from('funnel_tabs')
      .insert({
        funnel_id: funnelId,
        company_id: companyId,
        name: name || 'Untitled',
        position: isFirst ? 0 : Math.max(...tabs.map((t) => t.position)) + 1,
      })
      .select().single();
    if (error || !data) { markDone(false); toast.error('Failed to create tab'); return null; }

    if (isFirst) {
      // Backfill: assign all existing content to this first tab so nothing disappears
      await Promise.all([
        supabase.from('funnel_steps').update({ tab_id: data.id }).eq('funnel_id', funnelId).is('tab_id', null),
        supabase.from('funnel_board_edges').update({ tab_id: data.id }).eq('funnel_id', funnelId).is('tab_id', null),
        supabase.from('funnel_board_shapes').update({ tab_id: data.id }).eq('funnel_id', funnelId).is('tab_id', null),
        supabase.from('funnel_board_notes').update({ tab_id: data.id }).eq('funnel_id', funnelId).is('tab_id', null),
      ]);
    }

    markDone(true);
    setTabs((prev) => [...prev, data]);

    if (isFirst) {
      setActiveTabId(data.id);
    }

    return data;
  }, [funnelId, companyId, tabs, toast, markSaving, markDone, setTabs, setActiveTabId]);

  const renameTab = useCallback(async (id: string, name: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    markSaving();
    const { error } = await supabase
      .from('funnel_tabs')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);
    markDone(!error);
    if (error) toast.error('Failed to rename tab');
  }, [toast, markSaving, markDone, setTabs]);

  const reorderTabs = useCallback(async (orderedIds: string[]) => {
    setTabs((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      return orderedIds.map((id, i) => ({ ...map.get(id)!, position: i }));
    });
    markSaving();
    const updates = orderedIds.map((id, i) =>
      supabase.from('funnel_tabs').update({ position: i, updated_at: new Date().toISOString() }).eq('id', id)
    );
    await Promise.all(updates);
    markDone(true);
  }, [markSaving, markDone, setTabs]);

  const deleteTab = useCallback(async (id: string) => {
    if (tabs.length <= 1) { toast.error('Cannot delete the last tab'); return; }
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTabId((prev) => {
      if (prev !== id) return prev;
      const remaining = tabs.filter((t) => t.id !== id);
      return remaining[Math.min(idx, remaining.length - 1)]?.id ?? null;
    });
    markSaving();
    await supabase.from('funnel_tabs').delete().eq('id', id);
    markDone(true);
  }, [tabs, toast, markSaving, markDone, setTabs, setActiveTabId]);

  return { createTab, renameTab, reorderTabs, deleteTab };
}
