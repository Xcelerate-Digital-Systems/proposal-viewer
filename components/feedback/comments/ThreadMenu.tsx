'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

interface Props {
  onEdit?: () => void;
  onDelete?: () => void;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * Three-dot menu used on comments and replies for edit / delete actions.
 * Shared between CommentThread and ReplyItem.
 */
export default function ThreadMenu({ onEdit, onDelete, align = 'end', className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className ?? ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="More actions"
      >
        <MoreHorizontal size={12} />
      </button>
      {open && (
        <div
          className={`absolute z-30 top-full mt-1 ${align === 'end' ? 'right-0' : 'left-0'} bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[120px]`}
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
