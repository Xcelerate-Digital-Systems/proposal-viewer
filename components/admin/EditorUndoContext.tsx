// components/admin/EditorUndoContext.tsx
// Lightweight undo stack for the proposal/template/document editors.
// Each editor pushes {label, undo()} entries before committing destructive
// changes. Cmd+Z (when no text field is focused) pops and executes.
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useToast } from '@/components/ui/Toast';

interface UndoEntry {
  label: string;
  undo: () => void | Promise<void>;
}

interface EditorUndoContextValue {
  push: (label: string, undoFn: () => void | Promise<void>) => void;
  undo: () => void;
  canUndo: () => boolean;
}

const EditorUndoContext = createContext<EditorUndoContextValue | null>(null);

const MAX_STACK = 50;

export function EditorUndoProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const stackRef = useRef<UndoEntry[]>([]);
  const undoingRef = useRef(false);

  const push = useCallback((label: string, undoFn: () => void | Promise<void>) => {
    stackRef.current = [...stackRef.current.slice(-MAX_STACK + 1), { label, undo: undoFn }];
  }, []);

  const undo = useCallback(async () => {
    if (undoingRef.current) return;
    const entry = stackRef.current.pop();
    if (!entry) return;
    undoingRef.current = true;
    try {
      await entry.undo();
      toast.success(`Undone: ${entry.label}`);
    } catch {
      toast.error('Undo failed');
    } finally {
      undoingRef.current = false;
    }
  }, [toast]);

  const canUndo = useCallback(() => stackRef.current.length > 0, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z' || e.shiftKey) return;

      const el = document.activeElement;
      if (!el) return;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable) return;

      if (stackRef.current.length === 0) return;
      e.preventDefault();
      undo();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo]);

  return (
    <EditorUndoContext.Provider value={{ push, undo, canUndo }}>
      {children}
    </EditorUndoContext.Provider>
  );
}

export function useEditorUndo() {
  return useContext(EditorUndoContext);
}
