'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { supabase, type FeedbackItem, type FeedbackStatus } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';

interface UseBoardItemMutationsArgs {
  projectId: string;
  toast: { error: (msg: string) => void };
  refreshItems: () => Promise<void>;
  loadBoardEdges: () => Promise<void>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
  placedItemsLength: number;
  setItems: Dispatch<SetStateAction<FeedbackItem[]>>;
}

export function useBoardItemMutations({
  projectId,
  toast,
  refreshItems,
  loadBoardEdges,
  markSaving,
  markDone,
  placedItemsLength,
  setItems,
}: UseBoardItemMutationsArgs) {
  const placeItem = useCallback(
    async (itemId: string, position?: { x: number; y: number }) => {
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
    },
    [placedItemsLength, toast, refreshItems, markSaving, markDone]
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
    [toast, refreshItems, setItems]
  );

  const updateItemBoardColor = useCallback(
    async (itemId: string, color: string | null) => {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, board_color: color } : i)));
      const { error } = await supabase
        .from('review_items')
        .update({ board_color: color, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) {
        toast.error('Failed to save colour');
        refreshItems();
      }
    },
    [toast, refreshItems, setItems]
  );

  return {
    placeItem,
    removeItemFromBoard,
    updateItemStatus,
    updateItemBoardPosition,
    updateItemBoardColor,
  };
}
