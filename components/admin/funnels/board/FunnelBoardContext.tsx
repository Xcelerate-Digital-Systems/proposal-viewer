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

export type NewStep = Omit<FunnelStep, 'id' | 'funnel_id' | 'company_id' | 'created_at' | 'updated_at'>;
export type NewShape = Omit<FunnelBoardShape, 'id' | 'funnel_id' | 'company_id' | 'created_at' | 'updated_at'>;
export type NewEdge = Omit<FunnelBoardEdge, 'id' | 'created_at' | 'updated_at'>;

interface ContextValue {
  funnelId: string;
  companyId: string;
  userId: string | null;

  funnel: Funnel | null;
  setFunnel: (updater: (prev: Funnel | null) => Funnel | null) => void;
  loading: boolean;

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
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [boardEdges, setBoardEdges] = useState<FunnelBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<FunnelBoardNote[]>([]);
  const [shapes, setShapes] = useState<FunnelBoardShape[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadSteps = useCallback(async () => {
    const { data } = await supabase
      .from('funnel_steps').select('*').eq('funnel_id', funnelId).order('created_at');
    setSteps(data || []);
  }, [funnelId]);

  const loadEdges = useCallback(async () => {
    const { data } = await supabase.from('funnel_board_edges').select('*').eq('funnel_id', funnelId);
    setBoardEdges(data || []);
  }, [funnelId]);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase.from('funnel_board_notes').select('*').eq('funnel_id', funnelId);
    setBoardNotes(data || []);
  }, [funnelId]);

  const loadShapes = useCallback(async () => {
    const { data } = await supabase.from('funnel_board_shapes').select('*').eq('funnel_id', funnelId);
    setShapes(data || []);
  }, [funnelId]);

  useEffect(() => {
    Promise.all([fetchFunnel(), loadSteps(), loadEdges(), loadNotes(), loadShapes()])
      .finally(() => setLoading(false));
  }, [fetchFunnel, loadSteps, loadEdges, loadNotes, loadShapes]);

  // Mutation hooks
  const stepMutations = useFunnelStepMutations({
    funnelId, companyId, steps, setSteps, setSelectedStepId,
    boardEdges, setBoardEdges, markSaving, markDone, recordHistory, loadSteps,
  });

  const noteMutations = useFunnelNoteMutations({
    funnelId, companyId, boardNotes, setBoardNotes, markSaving, markDone, recordHistory,
  });

  const edgeMutations = useFunnelEdgeMutations({
    funnelId, companyId, boardEdges, setBoardEdges, markSaving, markDone, recordHistory, loadEdges,
  });

  const shapeMutations = useFunnelShapeMutations({
    funnelId, companyId, shapes, setShapes, boardEdges, setBoardEdges,
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
      selectedStepId, selectStep,
      selectedShapeId, selectShape,
      selectedNoteId, selectNote,
      clearSelection,
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
