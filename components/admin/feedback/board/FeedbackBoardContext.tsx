'use client';

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import type {
  FeedbackItem,
  FeedbackProject,
  FeedbackBoardEdge,
  FeedbackBoardNote,
  FeedbackBoardShape,
  FeedbackStatus,
} from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';

import { useBoardData } from './useBoardData';
import { useBoardHistory } from './useBoardHistory';
import { useBoardSyncStatus } from './useBoardSyncStatus';
import { useBoardItemMutations } from './useBoardItemMutations';
import { useBoardNoteMutations } from './useBoardNoteMutations';
import { useBoardEdgeMutations } from './useBoardEdgeMutations';
import { useBoardShapeMutations } from './useBoardShapeMutations';

export type NewShape = Omit<FeedbackBoardShape, 'id' | 'review_project_id' | 'company_id' | 'created_at' | 'updated_at'>;
export type NewEdge = Omit<FeedbackBoardEdge, 'id' | 'created_at' | 'updated_at'>;

export type CommentStats = { total: number; unresolved: number };

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

  // Comment stats (bulk-fetched, not per-node)
  commentStats: Map<string, CommentStats>;

  syncStatus: 'idle' | 'saving' | 'error';

  // Items
  placeItem: (itemId: string, position?: { x: number; y: number }) => Promise<void>;
  removeItemFromBoard: (itemId: string) => Promise<void>;
  updateItemStatus: (itemId: string, status: FeedbackStatus) => Promise<void>;
  updateItemBoardPosition: (itemId: string, x: number, y: number) => Promise<void>;
  updateItemBoardColor: (itemId: string, color: string | null) => Promise<void>;

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

  // Undo/redo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  undoLabels: string[];
  redoLabels: string[];
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
  const toast = useToast();
  const [showAddItem, setShowAddItem] = useState(false);

  // Data fetching
  const {
    project,
    setProjectState,
    items,
    setItems,
    boardEdges,
    setBoardEdges,
    boardNotes,
    setBoardNotes,
    shapes,
    setShapes,
    loading,
    customDomain,
    commentStats,
    refreshItems,
    loadBoardEdges,
    loadShapes,
  } = useBoardData(projectId, companyId);

  // Sync status
  const { syncStatus, markSaving, markDone } = useBoardSyncStatus();

  // Undo/redo
  const { recordHistory, undo, redo, canUndo, canRedo, undoLabels, redoLabels } = useBoardHistory();

  // Derived lists
  const placedItems = useMemo(
    () => items.filter((i) => i.board_x != null && i.board_y != null),
    [items]
  );
  const unplacedItems = useMemo(
    () => items.filter((i) => i.board_x == null || i.board_y == null),
    [items]
  );

  // Item mutations
  const {
    placeItem,
    removeItemFromBoard,
    updateItemStatus,
    updateItemBoardPosition,
    updateItemBoardColor,
  } = useBoardItemMutations({
    projectId,
    toast,
    refreshItems,
    loadBoardEdges,
    markSaving,
    markDone,
    placedItemsLength: placedItems.length,
    setItems,
  });

  // Note mutations
  const { addNote, updateNote, deleteNote } = useBoardNoteMutations({
    projectId,
    companyId,
    boardNotes,
    setBoardNotes,
    toast,
    recordHistory,
    undo,
  });

  // Edge mutations
  const { createEdge, updateEdge, deleteEdge } = useBoardEdgeMutations({
    projectId,
    companyId,
    setBoardEdges,
    toast,
    loadBoardEdges,
  });

  // Shape mutations
  const { createShape, updateShape, deleteShape } = useBoardShapeMutations({
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
  });

  // Wrapper to keep the same public API
  const setProject = useCallback(
    (updater: (prev: FeedbackProject | null) => FeedbackProject | null) => {
      setProjectState((prev) => updater(prev));
    },
    [setProjectState]
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
      commentStats,
      syncStatus,
      placeItem,
      removeItemFromBoard,
      updateItemStatus,
      updateItemBoardPosition,
      updateItemBoardColor,
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
      undo, redo,
      canUndo,
      canRedo,
      undoLabels,
      redoLabels,
    }),
    [
      projectId, companyId, userId,
      project, setProject,
      items, placedItems, unplacedItems,
      commentStats, syncStatus,
      customDomain, loading,
      refreshItems,
      placeItem, removeItemFromBoard, updateItemStatus, updateItemBoardPosition, updateItemBoardColor,
      boardNotes, addNote, updateNote, deleteNote,
      boardEdges, createEdge, updateEdge, deleteEdge,
      shapes, createShape, updateShape, deleteShape,
      undo, redo, canUndo, canRedo, undoLabels, redoLabels,
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
