'use client';

import { useCallback, useRef, useState } from 'react';

export type HistoryOp = {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  label?: string;
};

export function useBoardHistory() {
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

  const canUndo = historyRef.current.undo.length > 0;
  const canRedo = historyRef.current.redo.length > 0;

  const undoLabels = historyRef.current.undo.map((op) => op.label || 'Action').reverse();
  const redoLabels = historyRef.current.redo.map((op) => op.label || 'Action').reverse();

  return { historyRef, recordHistory, undo, redo, canUndo, canRedo, undoLabels, redoLabels };
}
