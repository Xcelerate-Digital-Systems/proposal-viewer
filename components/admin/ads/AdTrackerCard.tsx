// components/admin/ads/AdTrackerCard.tsx
'use client';

import { Megaphone, Trash2, MoreHorizontal } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { AdTrackerWithCount } from '@/lib/supabase';

type Props = {
  tracker: AdTrackerWithCount;
  onClick: () => void;
  onDelete: () => void;
};

export default function AdTrackerCard({ tracker, onClick, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-edge rounded-xl p-5 hover:border-teal/30 cursor-pointer transition-colors group relative"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
          <Megaphone size={18} className="text-muted" />
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-edge rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-ink mb-0.5 truncate">{tracker.name}</h3>
      {tracker.client_name && (
        <p className="text-xs text-muted truncate">{tracker.client_name}</p>
      )}
      {tracker.description && (
        <p className="text-xs text-faint truncate mt-0.5 mb-2">{tracker.description}</p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {tracker.creative_count} creative{tracker.creative_count !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-faint">
          {new Date(tracker.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
