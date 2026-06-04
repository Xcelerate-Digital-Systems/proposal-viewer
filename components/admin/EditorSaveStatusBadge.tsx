// components/admin/EditorSaveStatusBadge.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, Undo2 } from 'lucide-react';
import { useEditorSaveStatus } from './EditorSaveStatusContext';
import { useEditorUndo } from './EditorUndoContext';

export default function EditorSaveStatusBadge() {
  const ctx = useEditorSaveStatus();
  const undo = useEditorUndo();
  const [hasUndo, setHasUndo] = useState(false);

  useEffect(() => {
    if (!undo) return;
    const interval = setInterval(() => setHasUndo(undo.canUndo()), 500);
    return () => clearInterval(interval);
  }, [undo]);

  if (!ctx) return null;
  const { status } = ctx;

  return (
    <span className="flex items-center gap-2.5">
      {status === 'saving' && (
        <span className="flex items-center gap-1.5 text-xs text-faint">
          <Loader2 size={12} className="animate-spin" />
          Saving…
        </span>
      )}
      {status === 'saved' && (
        <span className="flex items-center gap-1.5 text-xs text-emerald-500">
          <Check size={12} />
          Saved
        </span>
      )}
      {hasUndo && status === 'idle' && (
        <button
          type="button"
          onClick={() => undo?.undo()}
          className="flex items-center gap-1 text-xs text-faint hover:text-teal transition-colors"
          title="Undo last change (⌘Z)"
        >
          <Undo2 size={12} />
          Undo
        </button>
      )}
    </span>
  );
}
