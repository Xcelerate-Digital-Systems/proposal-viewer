'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { supabase, type FeedbackBoardNote } from '@/lib/supabase';
import { NOTE_COLORS } from './nodes/StickyNoteNode';
import type { HistoryOp } from './useBoardHistory';

interface UseBoardNoteMutationsArgs {
  projectId: string;
  companyId: string;
  boardNotes: FeedbackBoardNote[];
  setBoardNotes: Dispatch<SetStateAction<FeedbackBoardNote[]>>;
  toast: { error: (msg: string) => void; info: (msg: string, opts?: { action?: { label: string; onClick: () => void } }) => void };
  recordHistory: (op: HistoryOp) => void;
  undo: () => Promise<void>;
}

export function useBoardNoteMutations({
  projectId,
  companyId,
  boardNotes,
  setBoardNotes,
  toast,
  recordHistory,
  undo,
}: UseBoardNoteMutationsArgs) {
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
    const created = data;
    recordHistory({
      label: 'Add note',
      undo: async () => {
        setBoardNotes((prev) => prev.filter((n) => n.id !== created.id));
        await supabase.from('review_board_notes').delete().eq('id', created.id);
      },
      redo: async () => {
        setBoardNotes((prev) => prev.some((n) => n.id === created.id) ? prev : [...prev, created]);
        await supabase.from('review_board_notes').insert(created);
      },
    });
    return data;
  }, [projectId, companyId, boardNotes.length, toast, setBoardNotes, recordHistory]);

  const updateNote = useCallback(
    async (noteId: string, changes: Partial<FeedbackBoardNote>) => {
      const before = boardNotes.find((n) => n.id === noteId);
      const beforePatch: Partial<FeedbackBoardNote> | null = before
        ? Object.keys(changes).reduce<Partial<FeedbackBoardNote>>((acc, key) => {
            (acc as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key];
            return acc;
          }, {})
        : null;

      setBoardNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...changes } : n)));
      await supabase
        .from('review_board_notes')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', noteId);

      if (beforePatch) {
        recordHistory({
          label: 'Edit note',
          undo: async () => {
            setBoardNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...beforePatch } : n)));
            await supabase.from('review_board_notes').update({ ...beforePatch, updated_at: new Date().toISOString() }).eq('id', noteId);
          },
          redo: async () => {
            setBoardNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...changes } : n)));
            await supabase.from('review_board_notes').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', noteId);
          },
        });
      }
    },
    [boardNotes, setBoardNotes, recordHistory]
  );

  const deleteNote = useCallback(async (noteId: string) => {
    const before = boardNotes.find((n) => n.id === noteId);
    setBoardNotes((prev) => prev.filter((n) => n.id !== noteId));
    await supabase.from('review_board_notes').delete().eq('id', noteId);
    if (before) {
      recordHistory({
        label: 'Delete note',
        undo: async () => {
          setBoardNotes((prev) => prev.some((n) => n.id === before.id) ? prev : [...prev, before]);
          await supabase.from('review_board_notes').insert(before);
        },
        redo: async () => {
          setBoardNotes((prev) => prev.filter((n) => n.id !== noteId));
          await supabase.from('review_board_notes').delete().eq('id', noteId);
        },
      });
      toast.info('Note deleted', { action: { label: 'Undo', onClick: () => void undo() } });
    }
  }, [boardNotes, setBoardNotes, recordHistory, toast, undo]);

  return { addNote, updateNote, deleteNote };
}
