'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Globe, FolderOpen } from 'lucide-react';

export type SiblingSide = 'left' | 'right';
export type SiblingType = 'webpage' | 'section';

interface SitemapSiblingMenuProps {
  side: SiblingSide;
  onAdd: (side: SiblingSide, type: SiblingType) => void;
}

export default function SitemapSiblingMenu({ side, onAdd }: SitemapSiblingMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const isLeft = side === 'left';

  return (
    <div
      ref={menuRef}
      className={`absolute top-1/2 -translate-y-1/2 z-20 ${
        isLeft ? '-left-3' : '-right-3'
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="nodrag nopan w-6 h-6 rounded-full bg-white border border-slate-300 text-slate-400 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:border-teal hover:text-teal hover:bg-teal-50"
        title={`Add ${isLeft ? 'before' : 'after'}`}
      >
        <Plus size={11} />
      </button>

      {open && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 bg-white rounded-xl border border-edge shadow-popover py-1 min-w-[130px] z-50 ${
            isLeft ? 'right-8' : 'left-8'
          }`}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onAdd(side, 'webpage'); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-prose hover:bg-surface transition-colors"
          >
            <Globe size={12} className="text-sky-500" />
            Add Page
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onAdd(side, 'section'); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-prose hover:bg-surface transition-colors"
          >
            <FolderOpen size={12} className="text-slate-500" />
            Add Section
          </button>
        </div>
      )}
    </div>
  );
}
