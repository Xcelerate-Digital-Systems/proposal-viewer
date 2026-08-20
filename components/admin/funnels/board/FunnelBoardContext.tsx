'use client';

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  supabase,
  type Funnel,
  type FunnelTab,
  type FunnelStep,
  type FunnelStepType,
  type FunnelBoardEdge,
  type FunnelBoardNote,
  type FunnelBoardShape,
} from '@/lib/supabase';
import { useBoardSyncStatus } from '@/components/admin/feedback/board/useBoardSyncStatus';
import { useBoardHistory } from '@/components/admin/feedback/board/useBoardHistory';
import { useFunnelStepMutations } from './useFunnelStepMutations';
import { useFunnelNoteMutations } from './useFunnelNoteMutations';
import { useFunnelEdgeMutations } from './useFunnelEdgeMutations';
import { useFunnelShapeMutations } from './useFunnelShapeMutations';
import { useFunnelTabMutations } from './useFunnelTabMutations';

export type NewStep = Omit<FunnelStep, 'id' | 'funnel_id' | 'company_id' | 'created_at' | 'updated_at' | 'linked_funnel_id' | 'tab_id' | 'linked_tab_id'>;
export type NewShape = Omit<FunnelBoardShape, 'id' | 'funnel_id' | 'company_id' | 'created_at' | 'updated_at' | 'linked_funnel_id' | 'tab_id' | 'linked_tab_id'>;
export type NewEdge = Omit<FunnelBoardEdge, 'id' | 'created_at' | 'updated_at' | 'tab_id'>;

interface ContextValue {
  funnelId: string;
  companyId: string;
  userId: string | null;

  funnel: Funnel | null;
  setFunnel: (updater: (prev: Funnel | null) => Funnel | null) => void;
  loading: boolean;

  // Tabs
  tabs: FunnelTab[];
  activeTabId: string | null;
  tabsEnabled: boolean;
  switchTab: (id: string) => void;
  createTab: (name?: string) => Promise<FunnelTab | null>;
  renameTab: (id: string, name: string) => Promise<void>;
  reorderTabs: (orderedIds: string[]) => Promise<void>;
  deleteTab: (id: string) => Promise<void>;

  selectedStepId: string | null;
  selectStep: (id: string | null) => void;
  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;
  selectedNoteId: string | null;
  selectNote: (id: string | null) => void;
  clearSelection: () => void;

  steps: FunnelStep[];
  createStep: (stepType: FunnelStepType, position: { x: number; y: number }) => Promise<FunnelStep | null>;
  updateStep: (id: string, patch: Partial<FunnelStep>) => Promise<void>;
  deleteStep: (id: string) => Promise<void>;

  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  undoLabels: string[];
  redoLabels: string[];

  syncStatus: 'idle' | 'saving' | 'error';

  boardNotes: FunnelBoardNote[];
  addNote: (position?: { x: number; y: number }) => Promise<FunnelBoardNote | null>;
  updateNote: (id: string, changes: Partial<FunnelBoardNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  boardEdges: FunnelBoardEdge[];
  createEdge: (edge: NewEdge) => Promise<FunnelBoardEdge | null>;
  updateEdge: (id: string, patch: Partial<FunnelBoardEdge>) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;

  shapes: FunnelBoardShape[];
  createShape: (shape: NewShape) => Promise<FunnelBoardShape | null>;
  updateShape: (id: string, patch: Partial<FunnelBoardShape>) => Promise<void>;
  deleteShape: (id: string) => Promise<void>;
}

const Ctx = createContext<ContextValue | null>(null);

export function useFunnelBoardContext(): ContextValue | null {
  return useContext(Ctx);
}

export function useFunnelBoardContextOrThrow(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFunnelBoardContext must be used inside FunnelBoardProvider');
  return ctx;
}

interface ProviderProps {
  funnelId: string;
  companyId: string;
  userId: string | null;
  children: ReactNode;
}

export function FunnelBoardProvider({ funnelId, companyId, userId, children }: ProviderProps) {
  const router = useRouter();

  const [funnel, setFunnelState] = useState<Funnel | null>(null);
  const [allSteps, setAllSteps] = useState<FunnelStep[]>([]);
  const [allBoardEdges, setAllBoardEdges] = useState<FunnelBoardEdge[]>([]);
  const [allBoardNotes, setAllBoardNotes] = useState<FunnelBoardNote[]>([]);
  const [allShapes, setAllShapes] = useState<FunnelBoardShape[]>([]);
  const [tabs, setTabs] = useState<FunnelTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tabsEnabled = tabs.length > 0;

  // Tab-filtered views — when tabs exist, only show content for the active tab.
  // When no tabs exist (legacy mode), show everything (tab_id is null for all rows).
  const steps = useMemo(
    () => tabsEnabled ? allSteps.filter((s) => s.tab_id === activeTabId) : allSteps,
    [allSteps, activeTabId, tabsEnabled]
  );
  const boardEdges = useMemo(
    () => tabsEnabled ? allBoardEdges.filter((e) => e.tab_id === activeTabId) : allBoardEdges,
    [allBoardEdges, activeTabId, tabsEnabled]
  );
  const boardNotes = useMemo(
    () => tabsEnabled ? allBoardNotes.filter((n) => n.tab_id === activeTabId) : allBoardNotes,
    [allBoardNotes, activeTabId, tabsEnabled]
  );
  const shapes = useMemo(
    () => tabsEnabled ? allShapes.filter((s) => s.tab_id === activeTabId) : allShapes,
    [allShapes, activeTabId, tabsEnabled]
  );

  // Selection — mutually exclusive
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectStep = useCallback((id: string | null) => {
    setSelectedStepId(id);
    if (id) { setSelectedShapeId(null); setSelectedNoteId(null); }
  }, []);
  const selectShape = useCallback((id: string | null) => {
    setSelectedShapeId(id);
    if (id) { setSelectedStepId(null); setSelectedNoteId(null); }
  }, []);
  const selectNote = useCallback((id: string | null) => {
    setSelectedNoteId(id);
    if (id) { setSelectedStepId(null); setSelectedShapeId(null); }
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedStepId(null); setSelectedShapeId(null); setSelectedNoteId(null);
  }, []);

  const switchTab = useCallback((id: string) => {
    setActiveTabId(id);
    clearSelection();
  }, [clearSelection]);

  // Shared infrastructure
  const { syncStatus, markSaving, markDone } = useBoardSyncStatus();
  const { recordHistory, undo, redo, canUndo, canRedo, undoLabels, redoLabels } = useBoardHistory();

  // Data loading
  const fetchFunnel = useCallback(async () => {
    const { data, error } = await supabase
      .from('funnels').select('*').eq('id', funnelId).eq('company_id', companyId).single();
    if (error || !data) { router.push('/funnels'); return; }
    setFunnelState(data);
  }, [funnelId, companyId, router]);

  const loadTabs = useCallback(async () => {
    const { data } = await supabase
      .from('funnel_tabs').select('*').eq('funnel_id', funnelId).order('position').order('created_at');
    const loaded = data || [];
    setTabs(loaded);
    if (loaded.length > 0) {
      setActiveTabId((prev) => {
        if (prev && loaded.some((t) => t.id === prev)) return prev;
        return loaded[0].id;
      });
    }
  }, [funnelId]);

  const loadSteps = useCallback(async () => {
    const { data } = await supabase
      .from('funnel_steps').select('*').eq('funnel_id', funnelId).order('created_at');
    setAllSteps(data || []);
  }, [funnelId]);

  const loadEdges = useCallback(async () => {
    const { data } = await supabase.from('funnel_board_edges').select('*').eq('funnel_id', funnelId);
    setAllBoardEdges(data || []);
  }, [funnelId]);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase.from('funnel_board_notes').select('*').eq('funnel_id', funnelId);
    setAllBoardNotes(data || []);
  }, [funnelId]);

  const loadShapes = useCallback(async () => {
    const { data } = await supabase.from('funnel_board_shapes').select('*').eq('funnel_id', funnelId);
    setAllShapes(data || []);
  }, [funnelId]);

  useEffect(() => {
    Promise.all([fetchFunnel(), loadTabs(), loadSteps(), loadEdges(), loadNotes(), loadShapes()])
      .finally(() => setLoading(false));
  }, [fetchFunnel, loadTabs, loadSteps, loadEdges, loadNotes, loadShapes]);

  // Tab mutations
  const tabMutations = useFunnelTabMutations({
    funnelId, companyId, tabs, setTabs, setActiveTabId, markSaving, markDone,
  });

  // After creating the first tab, reload all content so tab_id is reflected
  const createTab = useCallback(async (name?: string) => {
    const isFirst = tabs.length === 0;
    const result = await tabMutations.createTab(name);
    if (result && isFirst) {
      await Promise.all([loadSteps(), loadEdges(), loadNotes(), loadShapes()]);
    }
    return result;
  }, [tabs.length, tabMutations, loadSteps, loadEdges, loadNotes, loadShapes]);

  // Mutation hooks — pass activeTabId so new items get stamped
  const stepMutations = useFunnelStepMutations({
    funnelId, companyId, activeTabId,
    steps: allSteps, setSteps: setAllSteps, setSelectedStepId,
    boardEdges: allBoardEdges, setBoardEdges: setAllBoardEdges,
    markSaving, markDone, recordHistory, loadSteps,
  });

  const noteMutations = useFunnelNoteMutations({
    funnelId, companyId, activeTabId,
    boardNotes: allBoardNotes, setBoardNotes: setAllBoardNotes,
    markSaving, markDone, recordHistory,
  });

  const edgeMutations = useFunnelEdgeMutations({
    funnelId, companyId, activeTabId,
    boardEdges: allBoardEdges, setBoardEdges: setAllBoardEdges,
    markSaving, markDone, recordHistory, loadEdges,
  });

  const shapeMutations = useFunnelShapeMutations({
    funnelId, companyId, activeTabId,
    shapes: allShapes, setShapes: setAllShapes,
    boardEdges: allBoardEdges, setBoardEdges: setAllBoardEdges,
    markSaving, markDone, recordHistory, loadShapes,
  });

  const setFunnel = useCallback(
    (updater: (prev: Funnel | null) => Funnel | null) => setFunnelState((prev) => updater(prev)),
    []
  );

  const value = useMemo<ContextValue>(
    () => ({
      funnelId, companyId, userId,
      funnel, setFunnel, loading,
      // Tabs
      tabs, activeTabId, tabsEnabled, switchTab,
      createTab,
      renameTab: tabMutations.renameTab,
      reorderTabs: tabMutations.reorderTabs,
      deleteTab: tabMutations.deleteTab,
      // Selection
      selectedStepId, selectStep,
      selectedShapeId, selectShape,
      selectedNoteId, selectNote,
      clearSelection,
      // Tab-filtered data
      steps,
      ...stepMutations,
      undo, redo, canUndo, canRedo, undoLabels, redoLabels,
      syncStatus,
      boardNotes,
      ...noteMutations,
      boardEdges,
      ...edgeMutations,
      shapes,
      ...shapeMutations,
    }),
    [
      funnelId, companyId, userId, funnel, setFunnel, loading,
      tabs, activeTabId, tabsEnabled, switchTab,
      createTab, tabMutations,
      selectedStepId, selectStep,
      selectedShapeId, selectShape,
      selectedNoteId, selectNote,
      clearSelection,
      steps, stepMutations,
      undo, redo, canUndo, canRedo, undoLabels, redoLabels,
      syncStatus,
      boardNotes, noteMutations,
      boardEdges, edgeMutations,
      shapes, shapeMutations,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
