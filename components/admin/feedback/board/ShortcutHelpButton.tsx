'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { SHORTCUTS } from './feedback-board-config';

export default function ShortcutHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-edge shadow-sm text-ink/50 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-teal/30"
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
      >
        {open ? <X size={14} /> : <HelpCircle size={14} />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-edge rounded-xl shadow-lg p-3 z-50">
          <p className="text-2xs font-semibold text-dim uppercase tracking-wider mb-2">Keyboard shortcuts</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {SHORTCUTS.map(([key, label]) => (
              <div key={key} className="contents">
                <kbd className="text-2xs font-mono bg-surface border border-edge rounded px-1.5 py-0.5 text-ink/70 text-center min-w-[28px]">{key}</kbd>
                <span className="text-xs text-prose">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
