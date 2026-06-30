'use client';

import { useEffect, useRef } from 'react';
import { Copy, Trash2, Edit3, ClipboardPaste, Lock, Unlock } from 'lucide-react';

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
 *   - Pane menu (right-click empty canvas) — reserved for future paste/add actions
 *   - Node menu (right-click a node): edit, duplicate, delete
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

export default function CanvasContextMenu({
  target, onClose,
  onDuplicate, onDelete, onEdit, onLockToggle, isLocked,
  onPaste, canPaste, onAddStep,
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
    // Auto-focus first enabled menu item
    const first = ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const run = (fn?: () => void) => () => { fn?.(); onClose(); };

  type MenuItem = { icon: React.ReactNode; label: string; shortcut?: string; onClick?: () => void; danger?: boolean; disabled?: boolean };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? Math.min(idx + 1, buttons.length - 1) : Math.max(idx - 1, 0);
      buttons[next]?.focus();
    }
  };

  if (target.kind === 'pane') {
    const paneItems: MenuItem[] = [];
    if (onPaste) paneItems.push({ icon: <ClipboardPaste size={13} />, label: 'Paste', shortcut: '⌘V', onClick: run(onPaste), disabled: !canPaste });
    if (onAddStep) paneItems.push({ icon: <Copy size={13} />, label: 'Add step here', onClick: run(onAddStep) });
    if (paneItems.length === 0) return null;
    return (
      <div
        ref={ref}
        role="menu"
        className="fixed z-50 min-w-[180px] bg-white rounded-lg border border-edge shadow-xl py-1"
        style={clampPosition(target.clientX, target.clientY, paneItems.length)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleMenuKeyDown}
      >
        {paneItems.map((it, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={it.onClick}
            disabled={it.disabled}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors focus:outline-none focus:bg-surface ${
              it.disabled ? 'text-faint cursor-not-allowed' : 'text-ink hover:bg-surface'
            }`}
          >
            <span className="shrink-0 text-muted">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-2xs text-faint">{it.shortcut}</span>}
          </button>
        ))}
      </div>
    );
  }

  const items: MenuItem[] = [
    { icon: <Edit3 size={13} />,  label: 'Edit',         onClick: run(onEdit),     disabled: !onEdit },
    { icon: <Copy size={13} />,   label: selectionCount > 1 ? `Duplicate ${selectionCount}` : 'Duplicate', shortcut: '⌘D', onClick: run(onDuplicate) },
    ...(onLockToggle ? [{ icon: isLocked ? <Unlock size={13} /> : <Lock size={13} />, label: isLocked ? 'Unlock' : 'Lock', onClick: run(onLockToggle) }] : []),
    { icon: <Trash2 size={13} />, label: selectionCount > 1 ? `Delete ${selectionCount}` : 'Delete',    shortcut: '⌫',  onClick: run(onDelete), danger: true },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[180px] bg-white rounded-lg border border-edge shadow-xl py-1"
      style={clampPosition(target.clientX, target.clientY, items.length)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleMenuKeyDown}
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
