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
  type FeedbackItem,
  type FeedbackProject,
  type FeedbackBoardEdge,
  type FeedbackBoardNote,
  type FeedbackBoardShape,
  type FeedbackStatus,
} from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import { NOTE_COLORS } from './nodes/StickyNoteNode';

export type NewShape = Omit<FeedbackBoardShape, 'id' | 'review_project_id' | 'company_id' | 'created_at' | 'updated_at'>;
export type NewEdge = Omit<FeedbackBoardEdge, 'id' | 'created_at' | 'updated_at'>;

interface ContextValue {
  // Identity
  projectId: string;
  companyId: string;
  userId: string | null;

  // Project + top-level items
  project: FeedbackProject | null;
  setProject: (updater: (prev: FeedbackProject | null) => FeedbackProject | null) => void;
  items: FeedbackItem[];
  placedItems: FeedbackItem[];
  unplacedItems: FeedbackItem[];
  customDomain: string | null;
  loading: boolean;
  refreshItems: () => Promise<void>;
  openAddItem: () => void;

  // Items
  placeItem: (itemId: string) => Promise<void>;
  removeItemFromBoard: (itemId: string) => Promise<void>;
  updateItemStatus: (itemId: string, status: FeedbackStatus) => Promise<void>;
  updateItemBoardPosition: (itemId: string, x: number, y: number) => Promise<void>;

  // Sticky notes
  boardNotes: FeedbackBoardNote[];
  addNote: () => Promise<FeedbackBoardNote | null>;
  updateNote: (noteId: string, changes: Partial<FeedbackBoardNote>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;

  // Board edges (connections between item nodes)
  boardEdges: FeedbackBoardEdge[];
  createEdge: (edge: NewEdge) => Promise<FeedbackBoardEdge | null>;
  updateEdge: (id: string, patch: Partial<FeedbackBoardEdge>) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;

  // Free-draw shapes
  shapes: FeedbackBoardShape[];
  createShape: (shape: NewShape) => Promise<FeedbackBoardShape | null>;
  updateShape: (id: string, patch: Partial<FeedbackBoardShape>) => Promise<void>;
  deleteShape: (id: string) => Promise<void>;
}

const Ctx = createContext<ContextValue | null>(null);

export function useFeedbackBoardContext(): ContextValue | null {
  return useContext(Ctx);
}

export function useFeedbackBoardContextOrThrow(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFeedbackBoardContext must be used inside FeedbackBoardProvider');
  return ctx;
}

interface ProviderProps {
  projectId: string;
  companyId: string;
  userId: string | null;
  children: ReactNode;
}

export function FeedbackBoardProvider({
  projectId,
  companyId,
  userId,
  children,
}: ProviderProps) {
  const router = useRouter();
  const toast = useToast();

  const [project, setProjectState] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [boardEdges, setBoardEdges] = useState<FeedbackBoardEdge[]>([]);
  const [boardNotes, setBoardNotes] = useState<FeedbackBoardNote[]>([]);
  const [shapes, setShapes] = useState<FeedbackBoardShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);

  /* ─── Loaders ──────────────────────────────────────────────── */

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();
    if (error || !data) {
      router.push('/markup');
      return;
    }

    // Whiteboard share link is permanent — auto-create the token the first
    // time we load a project that doesn't have one yet so the share URL is
    // always ready to copy.
    let project = data;
    if (!project.board_share_token) {
      const newToken = crypto.randomUUID();
      const { data: updated } = await supabase
        .from('review_projects')
        .update({ board_share_token: newToken, updated_at: new Date().toISOString() })
        .eq('id', project.id)
        .select()
        .single();
      if (updated) project = updated;
    }

    setProjectState(project);
  }, [projectId, companyId, router]);

  const refreshItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });
    setItems(data || []);
  }, [projectId]);

  const loadBoardEdges = useCallback(async () => {
    const { data } = await supabase
      .from('review_board_edges')
      .select('*')
      .eq('review_project_id', projectId);
    setBoardEdges(data || []);
  }, [projectId]);

  const loadBoardNotes = useCallback(async () => {
    const { data } = await supabase
      .from('review_board_notes')
      .select('*')
      .eq('review_project_id', projectId);
    setBoardNotes(data || []);
  }, [projectId]);

  const loadShapes = useCallback(async () => {
    const { data } = await supabase
      .from('review_board_shapes')
      .select('*')
      .eq('review_project_id', projectId);
    setShapes(data || []);
  }, [projectId]);

  const fetchCustomDomain = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    }
  }, [companyId]);

  useEffect(() => {
    Promise.all([
      fetchProject(),
      refreshItems(),
      loadBoardEdges(),
      loadBoardNotes(),
      loadShapes(),
      fetchCustomDomain(),
    ]).finally(() => setLoading(false));
  }, [fetchProject, refreshItems, loadBoardEdges, loadBoardNotes, loadShapes, fetchCustomDomain]);

  /* ─── Items ────────────────────────────────────────────────── */

  const placedItems = useMemo(
    () => items.filter((i) => i.board_x != null && i.board_y != null),
    [items]
  );
  const unplacedItems = useMemo(
    () => items.filter((i) => i.board_x == null || i.board_y == null),
    [items]
  );

  const placeItem = useCallback(
    async (itemId: string) => {
      const existingCount = placedItems.length;
      const x = 100 + (existingCount % 4) * 280;
      const y = 100 + Math.floor(existingCount / 4) * 220;
      const { error } = await supabase
        .from('review_items')
        .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to place item on board');
        return;
      }
      refreshItems();
    },
    [placedItems.length, toast, refreshItems]
  );

  const removeItemFromBoard = useCallback(
    async (itemId: string) => {
      const { error } = await supabase
        .from('review_items')
        .update({ board_x: null, board_y: null, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to remove item from board');
        return;
      }
      await supabase
        .from('review_board_edges')
        .delete()
        .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);
      await Promise.all([refreshItems(), loadBoardEdges()]);
    },
    [toast, refreshItems, loadBoardEdges]
  );

  const updateItemStatus = useCallback(
    async (itemId: string, status: FeedbackStatus) => {
      const { error } = await supabase
        .from('review_items')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to update status');
        return;
      }
      refreshItems();
    },
    [toast, refreshItems]
  );

  // Persist a drag-end position and update local state so a subsequent
  // refreshItems() (triggered by status updates, add-item, etc.) doesn't
  // snap the node back to the last-seen DB coordinates before the save
  // completes. Without this, dragged nodes — especially compact icon-layout
  // ones like email/sms/ad — could visibly jump back after a race.
  const updateItemBoardPosition = useCallback(
    async (itemId: string, x: number, y: number) => {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_x: x, board_y: y } : i)));
      const { error } = await supabase
        .from('review_items')
        .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to save position');
        refreshItems();
      }
    },
    [toast, refreshItems]
  );

  /* ─── Sticky notes ─────────────────────────────────────────── */

  const addNote = useCallback(async (): Promise<FeedbackBoardNote | null> => {
    const existingCount = boardNotes.length;
    const x = 50 + (existingCount % 3) * 240;
    const y = 400 + Math.floor(existingCount / 3) * 200;
    const { data, error } = await supabase
      .from('review_board_notes')
      .insert({
        review_project_id: projectId,
        company_id: companyId,
        content: '',
        color: NOTE_COLORS[existingCount % NOTE_COLORS.length].value,
        board_x: x,
        board_y: y,
        width: 200,
        height: 150,
        font_size: 14,
      })
      .select()
      .single();
    if (error || !data) {
      toast.error('Failed to add note');
      return null;
    }
    setBoardNotes((prev) => [...prev, data]);
    return data;
  }, [projectId, companyId, boardNotes.length, toast]);

  const updateNote = useCallback(
    async (noteId: string, changes: Partial<FeedbackBoardNote>) => {
      setBoardNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...changes } : n)));
      await supabase
        .from('review_board_notes')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', noteId);
    },
    []
  );

  const deleteNote = useCallback(async (noteId: string) => {
    setBoardNotes((prev) => prev.filter((n) => n.id !== noteId));
    await supabase.from('review_board_notes').delete().eq('id', noteId);
  }, []);

  /* ─── Board edges ──────────────────────────────────────────── */

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
      if (data) setBoardEdges((prev) => [...prev, data]);
      return data;
    },
    [projectId, companyId, toast]
  );

  const updateEdge = useCallback(
    async (id: string, patch: Partial<FeedbackBoardEdge>) => {
      setBoardEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      const { error } = await supabase
        .from('review_board_edges')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        toast.error('Failed to update connection');
        loadBoardEdges();
      }
    },
    [toast, loadBoardEdges]
  );

  const deleteEdge = useCallback(
    async (id: string) => {
      setBoardEdges((prev) => prev.filter((e) => e.id !== id));
      await supabase.from('review_board_edges').delete().eq('id', id);
    },
    []
  );

  /* ─── Free-draw shapes ─────────────────────────────────────── */

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
      if (data) setShapes((prev) => [...prev, data]);
      return data;
    },
    [projectId, companyId, toast]
  );

  const updateShape = useCallback(
    async (id: string, patch: Partial<FeedbackBoardShape>) => {
      setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const { error } = await supabase
        .from('review_board_shapes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        toast.error('Failed to update shape');
        loadShapes();
      }
    },
    [toast, loadShapes]
  );

  const deleteShape = useCallback(
    async (id: string) => {
      setShapes((prev) => prev.filter((s) => s.id !== id));
      // Optimistically drop any edges touching this shape so the canvas stays
      // in sync; the DB cascade handles the server-side cleanup.
      setBoardEdges((prev) => prev.filter((e) => e.source_shape_id !== id && e.target_shape_id !== id));
      await supabase.from('review_board_shapes').delete().eq('id', id);
    },
    []
  );

  const setProject = useCallback(
    (updater: (prev: FeedbackProject | null) => FeedbackProject | null) => {
      setProjectState((prev) => updater(prev));
    },
    []
  );

  const value = useMemo<ContextValue>(
    () => ({
      projectId,
      companyId,
      userId,
      project,
      setProject,
      items,
      placedItems,
      unplacedItems,
      customDomain,
      loading,
      refreshItems,
      openAddItem: () => setShowAddItem(true),
      placeItem,
      removeItemFromBoard,
      updateItemStatus,
      updateItemBoardPosition,
      boardNotes,
      addNote,
      updateNote,
      deleteNote,
      boardEdges,
      createEdge,
      updateEdge,
      deleteEdge,
      shapes,
      createShape,
      updateShape,
      deleteShape,
    }),
    [
      projectId, companyId, userId,
      project, setProject,
      items, placedItems, unplacedItems,
      customDomain, loading,
      refreshItems,
      placeItem, removeItemFromBoard, updateItemStatus, updateItemBoardPosition,
      boardNotes, addNote, updateNote, deleteNote,
      boardEdges, createEdge, updateEdge, deleteEdge,
      shapes, createShape, updateShape, deleteShape,
    ]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {showAddItem && project && (
        <AddFeedbackItemModal
          reviewProjectId={project.id}
          companyId={companyId}
          userId={userId}
          nextSortOrder={items.length}
          onClose={() => setShowAddItem(false)}
          onSuccess={() => {
            refreshItems();
          }}
        />
      )}
    </Ctx.Provider>
  );
}
