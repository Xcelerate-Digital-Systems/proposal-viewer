'use client';

import { useEffect, useRef } from 'react';
import { Copy, Trash2, Edit3, ClipboardPaste, Lock, Unlock, Layers } from 'lucide-react';

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
  onCopyStyle?: () => void;
  onLockToggle?: () => void;
  isLocked?: boolean;
  /** Pane-context actions */
  onPaste?: () => void;
  canPaste?: boolean;
  onAddStep?: () => void;
  /** Optional: tell the user how many nodes the action will apply to */
  selectionCount?: number;
}

/**
 * Floating right-click context menu rendered at the cursor. Two flavours:
 *   - Pane menu (right-click empty canvas) — paste / add-step actions
 *   - Node menu (right-click a node): edit, duplicate, copy style, lock, delete
 *
 * Closes on outside-click, Escape, or after any action runs.
 */
const MENU_WIDTH = 180;
const MENU_ITEM_HEIGHT = 28;
const MENU_PADDING = 8;

function clampPosition(clientX: number, clientY: number, itemCount: number) {
  const menuH = itemCount * MENU_ITEM_HEIGHT + MENU_PADDING;
  const left = Math.min(clientX, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(clientY, window.innerHeight - menuH - 8);
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

type MenuItem = { icon: React.ReactNode; label: string; shortcut?: string; onClick?: () => void; danger?: boolean; disabled?: boolean };

export default function CanvasContextMenu({
  target, onClose,
  onDuplicate, onDelete, onEdit, onCopyStyle, onLockToggle, isLocked,
  onPaste, canPaste, onAddStep,
  selectionCount = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!ref.current) return;
      const btns = Array.from(ref.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (btns.length === 0) return;
      const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        btns[idx < 0 ? 0 : (idx + 1) % btns.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        btns[idx < 0 ? btns.length - 1 : (idx - 1 + btns.length) % btns.length].focus();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    });
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const run = (fn?: () => void) => () => { fn?.(); onClose(); };

  let items: MenuItem[];

  if (target.kind === 'pane') {
    const paneItems: MenuItem[] = [];
    if (onAddStep) paneItems.push({ icon: <Edit3 size={13} />, label: 'Add step here', onClick: run(onAddStep) });
    if (onPaste) paneItems.push({ icon: <ClipboardPaste size={13} />, label: 'Paste', shortcut: '⌘V', onClick: run(onPaste), disabled: !canPaste });
    if (paneItems.length === 0) return null;
    items = paneItems;
  } else {
    items = [
      { icon: <Edit3 size={13} />,  label: 'Edit',         onClick: run(onEdit),     disabled: !onEdit },
      { icon: <Copy size={13} />,   label: selectionCount > 1 ? `Duplicate ${selectionCount}` : 'Duplicate', shortcut: '⌘D', onClick: run(onDuplicate) },
      ...(onCopyStyle ? [{ icon: <Layers size={13} />, label: 'Copy style', onClick: run(onCopyStyle) }] : []),
      ...(onLockToggle ? [{ icon: isLocked ? <Unlock size={13} /> : <Lock size={13} />, label: isLocked ? 'Unlock' : 'Lock', onClick: run(onLockToggle) }] : []),
      { icon: <Trash2 size={13} />, label: selectionCount > 1 ? `Delete ${selectionCount}` : 'Delete',    shortcut: '⌫',  onClick: run(onDelete), danger: true },
    ];
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[180px] bg-white rounded-lg border border-edge shadow-xl py-1"
      style={clampPosition(target.clientX, target.clientY, items.length)}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={it.onClick}
          disabled={it.disabled}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors focus:outline-none focus:bg-surface ${
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
