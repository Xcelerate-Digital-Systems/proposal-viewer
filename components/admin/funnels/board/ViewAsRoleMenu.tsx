'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, UserRound } from 'lucide-react';
import type { FunnelRole } from '@/lib/supabase';

interface Props {
  roles: FunnelRole[];
  viewAsRoleId: string | null;
  onChange: (roleId: string | null) => void;
  /** How many nodes currently carry each role, so the menu shows what's there. */
  countsByRole?: Map<string, number>;
}

/**
 * "View as" filter. Picking a role fades every node that isn't owned by it, so
 * a busy board can be read one person's-worth at a time.
 *
 * Nothing is hidden — non-matching nodes dim rather than disappear, because the
 * connections between them are the whole point of the map.
 */
export default function ViewAsRoleMenu({ roles, viewAsRoleId, onChange, countsByRole }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = roles.find((r) => r.id === viewAsRoleId) || null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (roles.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
          selected
            ? 'border-teal text-teal bg-teal/5'
            : 'border-edge text-muted hover:text-ink hover:bg-surface'
        }`}
        title="Filter the board by who owns each step"
      >
        {selected ? (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
        ) : (
          <UserRound size={12} />
        )}
        <span className="truncate max-w-[120px]">
          {selected ? selected.name : 'View as'}
        </span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute z-40 right-0 mt-1 w-56 bg-white border border-edge rounded-lg shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-detail hover:bg-surface transition-colors text-left"
          >
            <UserRound size={12} className="text-faint shrink-0" />
            <span className="flex-1 text-ink">Everyone</span>
            {!viewAsRoleId && <Check size={12} className="text-teal shrink-0" />}
          </button>

          <div className="max-h-64 overflow-y-auto border-t border-edge">
            {roles.map((r) => {
              const count = countsByRole?.get(r.id) ?? 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onChange(r.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-detail hover:bg-surface transition-colors text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="flex-1 truncate text-ink">{r.name}</span>
                  <span className="text-2xs text-muted tabular-nums shrink-0">{count}</span>
                  {r.id === viewAsRoleId && <Check size={12} className="text-teal shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
