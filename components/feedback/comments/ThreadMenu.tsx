'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

interface Props {
  onEdit?: () => void;
  onDelete?: () => void;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * Three-dot menu used on comments and replies for edit / delete actions.
 * The popup is rendered with `position: fixed` and absolute viewport
 * coordinates so it can escape the comment list's `overflow-y-auto`
 * container (which would otherwise clip a downward menu near the bottom
 * of the panel). On open we measure the trigger button and flip the menu
 * upward when there isn't enough room below.
 */
export default function ThreadMenu({ onEdit, onDelete, align = 'end', className }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const compute = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const popup = popupRef.current;
      const popupHeight = popup?.offsetHeight ?? 80;
      const popupWidth = popup?.offsetWidth ?? 140;
      const margin = 4;

      // Vertical: prefer below the trigger; flip up if it would overflow.
      let top = rect.bottom + margin;
      if (top + popupHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - margin - popupHeight);
      }

      // Horizontal: align to the requested edge of the trigger.
      let left = align === 'end' ? rect.right - popupWidth : rect.left;
      left = Math.min(Math.max(8, left), window.innerWidth - popupWidth - 8);

      setPos({ top, left });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`relative inline-flex ${className ?? ''}`}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="More actions"
      >
        <MoreHorizontal size={12} />
      </button>
      {open && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="z-[70] bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[120px]"
        >
          {onEdit && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 text-left"
            >
              <Pencil size={12} className="text-gray-400" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 text-left"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
