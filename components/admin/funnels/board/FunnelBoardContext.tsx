'use client';

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
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
import { useToast } from '@/components/ui/Toast';
import { FUNNEL_STEP_DEFAULTS } from '@/lib/types/funnel';
import { NOTE_COLORS } from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import { computeForecast, type Forecast } from '@/lib/funnel/forecast';

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

  // Selection (drives the side drawer)
  selectedStepId: string | null;
  selectStep: (id: string | null) => void;

  // Display toggles
  showMetrics: boolean;
  setShowMetrics: (v: boolean) => void;

  // Steps
  steps: FunnelStep[];
  createStep: (stepType: FunnelStepType, position: { x: number; y: number }) => Promise<FunnelStep | null>;
  updateStep: (id: string, patch: Partial<FunnelStep>) => Promise<void>;
  deleteStep: (id: string) => Promise<void>;

  // Forecast — derived from steps + edges; re-computed on every change.
  forecast: Forecast;

  // Undo/redo. Wired into create/update/delete for steps and edges.
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;

  // Notes
  boardNotes: FunnelBoardNote[];
  addNote: () => Promise<FunnelBoardNote | null>;
  updateNote: (id: string, changes: Partial<FunnelBoardNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Edges
  boardEdges: FunnelBoardEdge[];
  createEdge: (edge: NewEdge) => Promise<FunnelBoardEdge | null>;
  updateEdge: (id: string, patch: Partial<FunnelBoardEdge>) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;

  // Shapes
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
  const toast = useToast();

  const [funnel, setFunnelState] = useState<Funnel | null>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [boardEdges, setBoardEdges] = useState<FunnelBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<FunnelBoardNote[]>([]);
  const [shapes, setShapes] = useState<FunnelBoardShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showMetrics, setShowMetricsState] = useState(true);

  const selectStep = useCallback((id: string | null) => setSelectedStepId(id), []);
  const setShowMetrics = useCallback((v: boolean) => setShowMetricsState(v), []);

  // ─── Undo/redo facility ─────────────────────────────────────────
  //
  // Each undoable mutation pushes an inverse pair { undo, redo } onto the
  // stack. While an entry is being replayed we set `suppress` so the
  // mutation doesn't re-record itself.
  type HistoryOp = { undo: () => Promise<void>; redo: () => Promise<void> };
  const historyRef = useRef<{ undo: HistoryOp[]; redo: HistoryOp[]; suppress: boolean }>({
    undo: [], redo: [], suppress: false,
  });
  const [, forceRender] = useState(0);
  const bumpHistoryUI = useCallback(() => forceRender((n) => n + 1), []);

  const recordHistory = useCallback((op: HistoryOp) => {
    if (historyRef.current.suppress) return;
    historyRef.current.undo.push(op);
    if (historyRef.current.undo.length > 30) historyRef.current.undo.shift();
    historyRef.current.redo.length = 0;
    bumpHistoryUI();
  }, [bumpHistoryUI]);

  const undo = useCallback(async () => {
    const op = historyRef.current.undo.pop();
    if (!op) return;
    historyRef.current.suppress = true;
    try { await op.undo(); } finally { historyRef.current.suppress = false; }
    historyRef.current.redo.push(op);
    bumpHistoryUI();
  }, [bumpHistoryUI]);

  const redo = useCallback(async () => {
    const op = historyRef.current.redo.pop();
    if (!op) return;
    historyRef.current.suppress = true;
    try { await op.redo(); } finally { historyRef.current.suppress = false; }
    historyRef.current.undo.push(op);
    bumpHistoryUI();
  }, [bumpHistoryUI]);

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

  /* ─── Steps ─────────────────────────────────────────────────── */

  // Low-level write that re-inserts an entire step row (used by undo of delete
  // and redo of create). Preserves the original id so edges still resolve.
  const insertStepRow = useCallback(async (row: FunnelStep) => {
    setSteps((prev) => prev.some((s) => s.id === row.id) ? prev : [...prev, row]);
    await supabase.from('funnel_steps').insert(row);
  }, []);

  const createStep = useCallback(
    async (stepType: FunnelStepType, position: { x: number; y: number }): Promise<FunnelStep | null> => {
      const defaults = FUNNEL_STEP_DEFAULTS[stepType];
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
      if (error || !data) { toast.error('Failed to add step'); return null; }
      setSteps((prev) => [...prev, data]);
      setSelectedStepId(data.id);
      // History: undo deletes the row; redo re-inserts the same row.
      const created: FunnelStep = data;
      recordHistory({
        undo: async () => {
          setSteps((prev) => prev.filter((s) => s.id !== created.id));
          setSelectedStepId((prev) => (prev === created.id ? null : prev));
          await supabase.from('funnel_steps').delete().eq('id', created.id);
        },
        redo: async () => { await insertStepRow(created); },
      });
      return data;
    },
    [funnelId, companyId, toast, recordHistory, insertStepRow]
  );

  const updateStep = useCallback(async (id: string, patch: Partial<FunnelStep>) => {
    // Snapshot the "before" values of just the patched fields, so undo
    // restores them without clobbering anything else the user has changed.
    const before = steps.find((s) => s.id === id);
    const beforePatch: Partial<FunnelStep> | null = before
      ? Object.keys(patch).reduce<Partial<FunnelStep>>((acc, key) => {
          (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
          return acc;
        }, {})
      : null;

    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase
      .from('funnel_steps')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Failed to save step'); loadSteps(); return; }

    if (beforePatch) {
      recordHistory({
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
  }, [steps, toast, loadSteps, recordHistory]);

  const deleteStep = useCallback(async (id: string) => {
    // Snapshot the step and all incident edges so undo can fully restore.
    const before = steps.find((s) => s.id === id);
    const incidentEdges = boardEdges.filter((e) => e.source_step_id === id || e.target_step_id === id);

    setSteps((prev) => prev.filter((s) => s.id !== id));
    setBoardEdges((prev) => prev.filter((e) => e.source_step_id !== id && e.target_step_id !== id));
    setSelectedStepId((prev) => (prev === id ? null : prev));
    await supabase.from('funnel_steps').delete().eq('id', id);

    if (before) {
      recordHistory({
        undo: async () => {
          await insertStepRow(before);
          // Restore incident edges
          if (incidentEdges.length > 0) {
            setBoardEdges((prev) => {
              const known = new Set(prev.map((e) => e.id));
              return [...prev, ...incidentEdges.filter((e) => !known.has(e.id))];
            });
            await supabase.from('funnel_board_edges').insert(incidentEdges);
          }
        },
        redo: async () => {
          setSteps((prev) => prev.filter((s) => s.id !== id));
          setBoardEdges((prev) => prev.filter((e) => e.source_step_id !== id && e.target_step_id !== id));
          await supabase.from('funnel_steps').delete().eq('id', id);
        },
      });
    }
  }, [steps, boardEdges, recordHistory, insertStepRow]);

  /* ─── Notes ─────────────────────────────────────────────────── */

  const addNote = useCallback(async (): Promise<FunnelBoardNote | null> => {
    const existing = boardNotes.length;
    const x = 50 + (existing % 3) * 240;
    const y = 400 + Math.floor(existing / 3) * 200;
    const { data, error } = await supabase
      .from('funnel_board_notes')
      .insert({
        funnel_id: funnelId,
        company_id: companyId,
        content: '',
        color: NOTE_COLORS[existing % NOTE_COLORS.length].value,
        board_x: x, board_y: y, width: 200, height: 150, font_size: 14,
      })
      .select().single();
    if (error || !data) { toast.error('Failed to add note'); return null; }
    setBoardNotes((prev) => [...prev, data]);
    return data;
  }, [funnelId, companyId, boardNotes.length, toast]);

  const updateNote = useCallback(async (id: string, changes: Partial<FunnelBoardNote>) => {
    setBoardNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes } : n)));
    await supabase.from('funnel_board_notes').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    setBoardNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('funnel_board_notes').delete().eq('id', id);
  }, []);

  /* ─── Edges ─────────────────────────────────────────────────── */

  const insertEdgeRow = useCallback(async (row: FunnelBoardEdge) => {
    setBoardEdges((prev) => prev.some((e) => e.id === row.id) ? prev : [...prev, row]);
    await supabase.from('funnel_board_edges').insert(row);
  }, []);

  const createEdge = useCallback(async (edge: NewEdge): Promise<FunnelBoardEdge | null> => {
    const { data, error } = await supabase
      .from('funnel_board_edges')
      .insert({ ...edge, funnel_id: funnelId, company_id: companyId })
      .select().single();
    if (error) { toast.error('Failed to create connection'); return null; }
    if (data) {
      setBoardEdges((prev) => [...prev, data]);
      const created = data as FunnelBoardEdge;
      recordHistory({
        undo: async () => {
          setBoardEdges((prev) => prev.filter((e) => e.id !== created.id));
          await supabase.from('funnel_board_edges').delete().eq('id', created.id);
        },
        redo: async () => { await insertEdgeRow(created); },
      });
    }
    return data;
  }, [funnelId, companyId, toast, recordHistory, insertEdgeRow]);

  const updateEdge = useCallback(async (id: string, patch: Partial<FunnelBoardEdge>) => {
    const before = boardEdges.find((e) => e.id === id);
    const beforePatch: Partial<FunnelBoardEdge> | null = before
      ? Object.keys(patch).reduce<Partial<FunnelBoardEdge>>((acc, key) => {
          (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
          return acc;
        }, {})
      : null;

    setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const { error } = await supabase
      .from('funnel_board_edges')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Failed to update connection'); loadEdges(); return; }

    if (beforePatch) {
      recordHistory({
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
  }, [boardEdges, toast, loadEdges, recordHistory]);

  const deleteEdge = useCallback(async (id: string) => {
    const before = boardEdges.find((e) => e.id === id);
    setBoardEdges((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('funnel_board_edges').delete().eq('id', id);
    if (before) {
      recordHistory({
        undo: async () => { await insertEdgeRow(before); },
        redo: async () => {
          setBoardEdges((prev) => prev.filter((e) => e.id !== id));
          await supabase.from('funnel_board_edges').delete().eq('id', id);
        },
      });
    }
  }, [boardEdges, recordHistory, insertEdgeRow]);

  /* ─── Shapes ────────────────────────────────────────────────── */

  const createShape = useCallback(async (shape: NewShape): Promise<FunnelBoardShape | null> => {
    const { data, error } = await supabase
      .from('funnel_board_shapes')
      .insert({ ...shape, funnel_id: funnelId, company_id: companyId })
      .select().single();
    if (error) { toast.error('Failed to create shape'); return null; }
    if (data) setShapes((prev) => [...prev, data]);
    return data;
  }, [funnelId, companyId, toast]);

  const updateShape = useCallback(async (id: string, patch: Partial<FunnelBoardShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase
      .from('funnel_board_shapes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Failed to save shape'); loadShapes(); }
  }, [toast, loadShapes]);

  const deleteShape = useCallback(async (id: string) => {
    setShapes((prev) => prev.filter((s) => s.id !== id));
    setBoardEdges((prev) => prev.filter((e) => e.source_shape_id !== id && e.target_shape_id !== id));
    await supabase.from('funnel_board_shapes').delete().eq('id', id);
  }, []);

  const setFunnel = useCallback(
    (updater: (prev: Funnel | null) => Funnel | null) => setFunnelState((prev) => updater(prev)),
    []
  );

  const forecast = useMemo(() => computeForecast(steps, boardEdges), [steps, boardEdges]);

  const canUndo = historyRef.current.undo.length > 0;
  const canRedo = historyRef.current.redo.length > 0;

  const value = useMemo<ContextValue>(
    () => ({
      funnelId, companyId, userId,
      funnel, setFunnel, loading,
      selectedStepId, selectStep,
      showMetrics, setShowMetrics,
      steps, createStep, updateStep, deleteStep,
      forecast,
      undo, redo, canUndo, canRedo,
      boardNotes, addNote, updateNote, deleteNote,
      boardEdges, createEdge, updateEdge, deleteEdge,
      shapes, createShape, updateShape, deleteShape,
    }),
    [
      funnelId, companyId, userId, funnel, setFunnel, loading,
      selectedStepId, selectStep,
      showMetrics, setShowMetrics,
      steps, createStep, updateStep, deleteStep, forecast,
      undo, redo, canUndo, canRedo,
      boardNotes, addNote, updateNote, deleteNote,
      boardEdges, createEdge, updateEdge, deleteEdge,
      shapes, createShape, updateShape, deleteShape,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
