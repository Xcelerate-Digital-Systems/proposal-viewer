'use client';

import { useCallback } from 'react';
import { supabase, type FunnelBoardNote } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { NOTE_COLORS } from '@/components/admin/feedback/board/nodes/StickyNoteNode';
import type { HistoryOp } from '@/components/admin/feedback/board/useBoardHistory';

interface Deps {
  funnelId: string;
  companyId: string;
  boardNotes: FunnelBoardNote[];
  setBoardNotes: React.Dispatch<React.SetStateAction<FunnelBoardNote[]>>;
  markSaving: () => void;
  markDone: (ok: boolean) => void;
  recordHistory: (op: HistoryOp) => void;
}

export function useFunnelNoteMutations(deps: Deps) {
  const toast = useToast();
  const { funnelId, companyId, boardNotes, setBoardNotes, markSaving, markDone, recordHistory } = deps;

  const addNote = useCallback(async (position?: { x: number; y: number }): Promise<FunnelBoardNote | null> => {
    const existing = boardNotes.length;
    const x = position ? Math.round(position.x) : 50 + (existing % 3) * 240;
    const y = position ? Math.round(position.y) : 400 + Math.floor(existing / 3) * 200;
    markSaving();
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
    markDone(!error);
    if (error || !data) { toast.error('Failed to add note'); return null; }
    setBoardNotes((prev) => [...prev, data]);
    return data;
  }, [funnelId, companyId, boardNotes.length, toast, markSaving, markDone, setBoardNotes]);

  const updateNote = useCallback(async (id: string, changes: Partial<FunnelBoardNote>) => {
    setBoardNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...changes } : n)));
    markSaving();
    await supabase.from('funnel_board_notes').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
    markDone(true);
  }, [markSaving, markDone, setBoardNotes]);

  const deleteNote = useCallback(async (id: string) => {
    const before = boardNotes.find((n) => n.id === id);
    setBoardNotes((prev) => prev.filter((n) => n.id !== id));
    markSaving();
    await supabase.from('funnel_board_notes').delete().eq('id', id);
    markDone(true);
    if (before) {
      recordHistory({
        label: 'Delete note',
        undo: async () => {
          setBoardNotes((prev) => prev.some((n) => n.id === before.id) ? prev : [...prev, before]);
          await supabase.from('funnel_board_notes').insert(before);
        },
        redo: async () => {
          setBoardNotes((prev) => prev.filter((n) => n.id !== id));
          await supabase.from('funnel_board_notes').delete().eq('id', id);
        },
      });
    }
  }, [boardNotes, recordHistory, markSaving, markDone, setBoardNotes]);

  return { addNote, updateNote, deleteNote };
}
