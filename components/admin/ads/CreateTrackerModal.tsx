// components/admin/ads/CreateTrackerModal.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  onClose: () => void;
  onCreate: (data: { name: string; client_name: string; description?: string }) => Promise<{ error?: string }>;
};

export default function CreateTrackerModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientName.trim()) return;

    setSaving(true);
    setError(null);

    const result = await onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      client_name: clientName.trim(),
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">New Campaign</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-faint hover:text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Coaches, Ecom Q1, SaaS Campaign"
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-[10px] text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">
              Client
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Doneverse, Acme Corp"
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-[10px] text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">
              Description <span className="text-faint font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this campaign for?"
              rows={2}
              className="w-full px-3.5 py-2.5 bg-surface border border-edge rounded-[10px] text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/30 transition-all resize-none"
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-600">{error}</p>
          )}

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
              disabled={!name.trim() || !clientName.trim() || saving}
              className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-teal hover:bg-teal-hover rounded-[10px] transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
