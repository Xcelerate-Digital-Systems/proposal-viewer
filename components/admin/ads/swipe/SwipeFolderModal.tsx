// components/admin/ads/swipe/SwipeFolderModal.tsx
'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';

type ShareTarget = { id: string; name: string };

type Props = {
  title: string;
  initialName?: string;
  initialDescription?: string;
  initialShared?: string[];
  /** Companies the current user can share this folder with. */
  shareTargets?: ShareTarget[];
  onClose: () => void;
  onSave: (data: {
    name?: string;
    description?: string;
    shared_with_company_ids?: string[];
  }) => Promise<void>;
};

export default function SwipeFolderModal({
  title,
  initialName = '',
  initialDescription = '',
  initialShared = [],
  shareTargets = [],
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [shared, setShared] = useState<Set<string>>(new Set(initialShared));
  const [saving, setSaving] = useState(false);

  const toggleShare = (id: string) => {
    setShared((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        shared_with_company_ids: Array.from(shared),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-faint hover:text-ink"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none"
              placeholder="e.g. Direct To Offer"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none resize-none"
            />
          </div>
          {shareTargets.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Share with</label>
              <div className="border border-edge rounded-lg divide-y divide-edge overflow-hidden">
                {shareTargets.map((t) => {
                  const on = shared.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleShare(t.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface"
                    >
                      <span className="text-ink truncate">{t.name}</span>
                      <span
                        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                          on ? 'bg-teal border-teal text-white' : 'border-edge bg-white'
                        }`}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-faint">
                Selected agencies can read and edit this folder&apos;s swipes. Only you can rename, delete, or change sharing.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-muted hover:text-ink">Cancel</button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
