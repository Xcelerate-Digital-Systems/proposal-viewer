'use client';

import { useState } from 'react';
import { History, Undo2, Redo2 } from 'lucide-react';

interface Props {
  undoLabels: string[];
  redoLabels: string[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function UndoHistoryPanel({ undoLabels, redoLabels, canUndo, canRedo, onUndo, onRedo }: Props) {
  const [open, setOpen] = useState(false);
  const hasHistory = undoLabels.length > 0 || redoLabels.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!hasHistory}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-ink/70 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="History"
      >
        <History size={14} />
      </button>

      {open && hasHistory && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-edge rounded-xl shadow-lg z-50 overflow-hidden">
            {undoLabels.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-edge bg-surface/50">
                  <Undo2 size={11} className="text-faint" />
                  <span className="text-2xs font-semibold text-dim uppercase tracking-wider">Undo</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {undoLabels.map((label, i) => (
                    <button
                      key={`undo-${i}`}
                      type="button"
                      onClick={() => { onUndo(); }}
                      disabled={i > 0}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        i === 0
                          ? 'text-ink hover:bg-surface cursor-pointer font-medium'
                          : 'text-faint cursor-default'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {undoLabels.length >= 30 && (
                  <div className="px-3 py-1.5 text-2xs text-faint border-t border-edge/50">
                    Earlier history trimmed
                  </div>
                )}
              </div>
            )}
            {redoLabels.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-t border-edge bg-surface/50">
                  <Redo2 size={11} className="text-faint" />
                  <span className="text-2xs font-semibold text-dim uppercase tracking-wider">Redo</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {redoLabels.map((label, i) => (
                    <button
                      key={`redo-${i}`}
                      type="button"
                      onClick={() => { onRedo(); }}
                      disabled={i > 0}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        i === 0
                          ? 'text-ink hover:bg-surface cursor-pointer font-medium'
                          : 'text-faint cursor-default'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
