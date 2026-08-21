'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Plus, UserRound, X } from 'lucide-react';
import type { FunnelRole } from '@/lib/supabase';
import { FUNNEL_ROLE_COLORS } from '@/lib/types/funnel';

interface Props {
  roles: FunnelRole[];
  roleId: string | null;
  /** Assign an existing role, or clear with null. */
  onAssign: (roleId: string | null) => void;
  /** Find-or-create by name, then assign. */
  onCreate: (name: string) => Promise<FunnelRole | null>;
  onRecolour?: (roleId: string, color: string) => void;
}

/**
 * Assigns an owning role to a node.
 *
 * A role is just a label — picking one here does not invite anyone to the
 * account or touch team membership. Typing a name that doesn't exist yet adds
 * it to the company's role library so it's offered on every other funnel.
 */
export default function RolePicker({ roles, roleId, onAssign, onCreate, onRecolour }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = roles.find((r) => r.id === roleId) || null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? roles.filter((r) => r.name.toLowerCase().includes(q)) : roles;
  const exactMatch = roles.some((r) => r.name.toLowerCase() === q);
  const canCreate = !!q && !exactMatch;

  const create = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    const role = await onCreate(query.trim());
    setBusy(false);
    if (role) onAssign(role.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">Owner</h4>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-edge text-caption text-left hover:border-teal transition-colors"
      >
        {selected ? (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selected.color }}
            />
            <span className="flex-1 truncate text-ink">{selected.name}</span>
          </>
        ) : (
          <>
            <UserRound size={13} className="text-faint shrink-0" />
            <span className="flex-1 text-muted">No owner</span>
          </>
        )}
        <ChevronDown size={12} className="text-muted shrink-0" />
      </button>

      {selected && (
        <div className="flex items-center gap-1 mt-1.5">
          {FUNNEL_ROLE_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onRecolour?.(selected.id, hex)}
              className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
                selected.color === hex ? 'border-ink' : 'border-edge'
              }`}
              style={{ backgroundColor: hex }}
              title={`Colour ${selected.name}`}
            />
          ))}
          <button
            type="button"
            onClick={() => onAssign(null)}
            className="ml-auto flex items-center gap-0.5 text-2xs text-muted hover:text-rose-600 transition-colors"
            title="Clear owner"
          >
            <X size={10} /> Clear
          </button>
        </div>
      )}

      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-edge rounded-lg shadow-lg overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); void create(); } }}
            placeholder="Search or type a new role…"
            className="w-full px-2.5 py-1.5 text-detail border-b border-edge outline-none"
          />

          <div className="max-h-52 overflow-y-auto">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onAssign(r.id); setOpen(false); setQuery(''); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-detail hover:bg-surface transition-colors text-left"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="flex-1 truncate text-ink">{r.name}</span>
                {r.id === roleId && <Check size={12} className="text-teal shrink-0" />}
              </button>
            ))}

            {canCreate && (
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-detail hover:bg-surface transition-colors text-left border-t border-edge disabled:opacity-50"
              >
                <Plus size={12} className="text-teal shrink-0" />
                <span className="truncate">Create &ldquo;{query.trim()}&rdquo;</span>
              </button>
            )}

            {filtered.length === 0 && !canCreate && (
              <p className="px-2.5 py-3 text-detail text-muted text-center">
                No roles yet — type a name to add one.
              </p>
            )}
          </div>

          <p className="px-2.5 py-1.5 text-2xs text-muted/70 border-t border-edge leading-snug">
            Roles are labels only. Adding one doesn&rsquo;t invite anyone to your account.
          </p>
        </div>
      )}
    </div>
  );
}
