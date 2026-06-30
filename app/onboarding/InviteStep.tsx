'use client';

import { useState } from 'react';
import { Users, ArrowRight, Plus, X } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { Button } from '@/components/ui/Button';

type DraftInvite = { email: string; role: 'admin' | 'member' };

export function InviteStep({ companyId, onNext }: { companyId: string; onNext: () => void }) {
  const [drafts, setDrafts] = useState<DraftInvite[]>([{ email: '', role: 'member' }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<DraftInvite>) => {
    setDrafts((d) => d.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addRow = () => setDrafts((d) => [...d, { email: '', role: 'member' }]);
  const removeRow = (idx: number) => setDrafts((d) => d.filter((_, i) => i !== idx));

  const sendInvites = async () => {
    setError(null);
    const filled = drafts.filter((d) => d.email.trim().length > 0);
    if (filled.length === 0) {
      onNext();
      return;
    }
    setSending(true);
    try {
      for (const row of filled) {
        const res = await authFetch(`/api/invites?company_id=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: row.email.trim(), role: row.role }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(`Failed to invite ${row.email}: ${json.error || 'unknown error'}`);
          setSending(false);
          return;
        }
      }
      onNext();
    } catch {
      setError('Network error sending invites');
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-teal-tint rounded-2xl flex items-center justify-center">
          <Users size={20} className="text-teal" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink">Invite your team</h2>
          <p className="text-xs text-muted">Optional. You can invite more people later.</p>
        </div>
      </div>

      <div className="space-y-2">
        {drafts.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="email"
              placeholder="teammate@youragency.com"
              value={row.email}
              onChange={(e) => update(idx, { email: e.target.value })}
              className="flex-1 px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            />
            <select
              value={row.role}
              onChange={(e) => update(idx, { role: e.target.value as DraftInvite['role'] })}
              className="px-3 py-2.5 rounded-lg bg-surface border border-edge text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              disabled={drafts.length === 1}
              className="text-faint hover:text-ink disabled:opacity-30 p-2"
              aria-label="Remove"
            >
              <X size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="text-xs text-teal hover:underline inline-flex items-center gap-1"
        >
          <Plus size={12} /> Add another
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="pt-2 flex gap-3">
        <Button variant="ghost" onClick={onNext} disabled={sending}>
          Skip for now
        </Button>
        <Button onClick={sendInvites} loading={sending} rightIcon={ArrowRight} fullWidth>
          {drafts.some((d) => d.email.trim()) ? 'Send & continue' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
