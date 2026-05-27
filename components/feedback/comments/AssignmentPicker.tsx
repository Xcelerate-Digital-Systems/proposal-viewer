'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type AssignableTeamMember = {
  id: string;
  name: string;
  email: string;
};

interface AssignmentPickerProps {
  participantsUrl: string | null;
  onAssign: (memberId: string, note: string) => Promise<void>;
  onClose: () => void;
}

export default function AssignmentPicker({
  participantsUrl,
  onAssign,
  onClose,
}: AssignmentPickerProps) {
  const [members, setMembers] = useState<AssignableTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!participantsUrl) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { authFetch } = await import('@/lib/auth-fetch');
        const res = await authFetch(participantsUrl);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const team = (data.participants ?? []).filter(
          (p: { kind: string }) => p.kind === 'team'
        );
        if (!cancelled) setMembers(team);
      } catch { /* swallow */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [participantsUrl]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = search
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
    : members;

  const handleSubmit = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      await onAssign(selectedId, note);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-50 mt-1 w-72 rounded-xl bg-white shadow-lg border border-edge ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-xs font-semibold text-ink">Assign to team member</span>
        <button onClick={onClose} className="p-0.5 rounded text-faint hover:text-prose">
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warm-dark">
          <Search size={13} className="text-faint shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team…"
            autoFocus
            className="flex-1 text-xs bg-transparent text-ink placeholder:text-faint focus:outline-none"
          />
        </div>
      </div>

      {/* Member list */}
      <div className="max-h-[160px] overflow-y-auto px-1.5 pb-1">
        {loading && (
          <p className="text-xs text-faint text-center py-4">Loading…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-faint text-center py-4">No team members found</p>
        )}
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
              selectedId === m.id
                ? 'bg-teal/8 ring-1 ring-teal/20'
                : 'hover:bg-surface'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-2xs font-semibold shrink-0">
              {m.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink truncate">{m.name}</p>
              <p className="text-2xs text-faint truncate">{m.email}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Note + submit */}
      {selectedId && (
        <div className="px-3 pb-3 pt-1 border-t border-edge-subtle space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Instructions (optional)…"
            rows={2}
            className="w-full text-xs rounded-lg bg-warm-dark px-2.5 py-2 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 resize-none"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            leftIcon={UserPlus}
            fullWidth
          >
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}
