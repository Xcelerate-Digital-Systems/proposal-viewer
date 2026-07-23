'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { supabase, type FeedbackItem, type FeedbackStatus } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import type { HistoryOp } from './useBoardHistory';

interface UseBoardItemMutationsArgs {
  projectId: string;
  items: FeedbackItem[];
  toast: { error: (msg: string) => void };
  refreshItems: () => Promise<void>;
  loadBoardEdges: () => Promise<void>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
  placedItemsLength: number;
  setItems: Dispatch<SetStateAction<FeedbackItem[]>>;
  recordHistory: (op: HistoryOp) => void;
}

export function useBoardItemMutations({
  projectId,
  items,
  toast,
  refreshItems,
  loadBoardEdges,
  markSaving,
  markDone,
  placedItemsLength,
  setItems,
  recordHistory,
}: UseBoardItemMutationsArgs) {
  const placeItem = useCallback(
    async (itemId: string, position?: { x: number; y: number }) => {
      const before = items.find((i) => i.id === itemId);
      const oldX = before?.board_x ?? null;
      const oldY = before?.board_y ?? null;
      const x = position ? Math.round(position.x) : 100 + (placedItemsLength % 4) * 280;
      const y = position ? Math.round(position.y) : 100 + Math.floor(placedItemsLength / 4) * 220;
      markSaving();
      const { error } = await supabase
        .from('review_items')
        .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      markDone(!error);
      if (error) {
        toast.error('Failed to place item on board');
        return;
      }
      refreshItems();
      recordHistory({
        label: 'Place item on board',
        undo: async () => {
          await supabase
            .from('review_items')
            .update({ board_x: oldX, board_y: oldY, updated_at: new Date().toISOString() })
            .eq('id', itemId);
          refreshItems();
        },
        redo: async () => {
          await supabase
            .from('review_items')
            .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
            .eq('id', itemId);
          refreshItems();
        },
      });
    },
    [items, placedItemsLength, toast, refreshItems, markSaving, markDone, recordHistory]
  );

  const removeItemFromBoard = useCallback(
    async (itemId: string) => {
      const before = items.find((i) => i.id === itemId);
      const oldX = before?.board_x ?? null;
      const oldY = before?.board_y ?? null;
      const { error } = await supabase
        .from('review_items')
        .update({ board_x: null, board_y: null, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to remove item from board');
        return;
      }
      // Capture edges before deleting them for undo
      const { data: removedEdges } = await supabase
        .from('review_board_edges')
        .select('*')
        .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);
      await supabase
        .from('review_board_edges')
        .delete()
        .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);
      await Promise.all([refreshItems(), loadBoardEdges()]);
      recordHistory({
        label: 'Remove item from board',
        undo: async () => {
          await supabase
            .from('review_items')
            .update({ board_x: oldX, board_y: oldY, updated_at: new Date().toISOString() })
            .eq('id', itemId);
          if (removedEdges && removedEdges.length > 0) {
            await supabase.from('review_board_edges').insert(removedEdges);
          }
          await Promise.all([refreshItems(), loadBoardEdges()]);
        },
        redo: async () => {
          await supabase
            .from('review_items')
            .update({ board_x: null, board_y: null, updated_at: new Date().toISOString() })
            .eq('id', itemId);
          await supabase
            .from('review_board_edges')
            .delete()
            .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);
          await Promise.all([refreshItems(), loadBoardEdges()]);
        },
      });
    },
    [items, toast, refreshItems, loadBoardEdges, recordHistory]
  );

  const updateItemStatus = useCallback(
    async (itemId: string, status: FeedbackStatus) => {
      const res = await authFetch(`/api/campaigns/${projectId}/items/${itemId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error('Failed to update status');
        return;
      }
      refreshItems();
    },
    [projectId, toast, refreshItems]
  );

  const updateItemBoardPosition = useCallback(
    async (itemId: string, x: number, y: number) => {
      const before = items.find((i) => i.id === itemId);
      const oldX = before?.board_x ?? 0;
      const oldY = before?.board_y ?? 0;
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_x: x, board_y: y } : i)));
      const { error } = await supabase
        .from('review_items')
        .update({ board_x: x, board_y: y, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to save position');
        refreshItems();
        return;
      }
      recordHistory({
        label: 'Move item',
        undo: async () => {
          setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_x: oldX, board_y: oldY } : i)));
          await supabase.from('review_items').update({ board_x: oldX, board_y: oldY, updated_at: new Date().toISOString() }).eq('id', itemId);
        },
        redo: async () => {
          setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_x: x, board_y: y } : i)));
          await supabase.from('review_items').update({ board_x: x, board_y: y, updated_at: new Date().toISOString() }).eq('id', itemId);
        },
      });
    },
    [items, toast, refreshItems, setItems, recordHistory]
  );

  const updateItemBoardColor = useCallback(
    async (itemId: string, color: string | null) => {
      const before = items.find((i) => i.id === itemId);
      const oldColor = before?.board_color ?? null;
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_color: color } : i)));
      const { error } = await supabase
        .from('review_items')
        .update({ board_color: color, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to save colour');
        refreshItems();
        return;
      }
      recordHistory({
        label: 'Change item colour',
        undo: async () => {
          setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_color: oldColor } : i)));
          await supabase.from('review_items').update({ board_color: oldColor, updated_at: new Date().toISOString() }).eq('id', itemId);
        },
        redo: async () => {
          setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_color: color } : i)));
          await supabase.from('review_items').update({ board_color: color, updated_at: new Date().toISOString() }).eq('id', itemId);
        },
      });
    },
    [items, toast, refreshItems, setItems, recordHistory]
  );

  return {
    placeItem,
    removeItemFromBoard,
    updateItemStatus,
    updateItemBoardPosition,
    updateItemBoardColor,
  };
}
