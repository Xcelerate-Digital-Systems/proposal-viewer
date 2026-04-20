// components/admin/ads/CreateClientModal.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = {
  onClose: () => void;
  onCreated: (client: { id: string; name: string; slug: string }) => void;
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function CreateClientModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !effectiveSlug.trim()) return;

    setSaving(true);
    setError(null);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setError('Not authenticated');
      setSaving(false);
      return;
    }

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), slug: effectiveSlug.trim() }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to create client');
      setSaving(false);
      return;
    }

    onCreated({ id: json.id, name: json.name, slug: json.slug });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">New Client</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Client name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acme Coaching"
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-[10px] text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">
              Slug <span className="text-faint font-normal">(used in URLs, lowercase)</span>
            </label>
            <input
              type="text"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="acme-coaching"
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-[10px] text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 transition-all"
            />
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-muted bg-surface rounded-[10px] hover:bg-edge transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !effectiveSlug.trim() || saving}
              className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-teal hover:bg-teal-hover rounded-[10px] transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
