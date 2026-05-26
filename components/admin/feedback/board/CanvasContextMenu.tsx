'use client';

import { useEffect, useRef } from 'react';
import { Copy, Trash2, Edit3 } from 'lucide-react';

export type ContextTarget =
  | { kind: 'pane'; clientX: number; clientY: number; flowX: number; flowY: number }
  | { kind: 'node'; nodeId: string; clientX: number; clientY: number };

interface Props {
  target: ContextTarget;
  onClose: () => void;
  /** Node-context actions */
  onDuplicate?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  /** Optional: tell the user how many nodes the action will apply to */
  selectionCount?: number;
}

/**
 * Floating right-click context menu rendered at the cursor. Two flavours:
 *   - Pane menu (right-click empty canvas) — reserved for future paste/add actions
 *   - Node menu (right-click a node): edit, duplicate, delete
 *
 * Closes on outside-click, Escape, or after any action runs.
 */
export default function CanvasContextMenu({
  target, onClose,
  onDuplicate, onDelete, onEdit,
  selectionCount = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const run = (fn?: () => void) => () => { fn?.(); onClose(); };

  if (target.kind === 'pane') {
    // No pane actions wired yet for feedback boards; suppress the menu.
    return null;
  }

  const items: { icon: React.ReactNode; label: string; shortcut?: string; onClick?: () => void; danger?: boolean; disabled?: boolean }[] = [
    { icon: <Edit3 size={13} />,  label: 'Edit',         onClick: run(onEdit),     disabled: !onEdit },
    { icon: <Copy size={13} />,   label: selectionCount > 1 ? `Duplicate ${selectionCount}` : 'Duplicate', shortcut: '⌘D', onClick: run(onDuplicate) },
    { icon: <Trash2 size={13} />, label: selectionCount > 1 ? `Delete ${selectionCount}` : 'Delete',    shortcut: '⌫',  onClick: run(onDelete), danger: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-white rounded-lg border border-edge shadow-xl py-1"
      style={{ left: target.clientX, top: target.clientY }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          onClick={it.onClick}
          disabled={it.disabled}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
            it.disabled
              ? 'text-faint cursor-not-allowed'
              : it.danger
              ? 'text-rose-600 hover:bg-rose-50'
              : 'text-ink hover:bg-surface'
          }`}
        >
          <span className={`shrink-0 ${it.danger ? 'text-rose-500' : 'text-muted'}`}>{it.icon}</span>
          <span className="flex-1">{it.label}</span>
          {it.shortcut && <span className="text-2xs text-faint">{it.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
