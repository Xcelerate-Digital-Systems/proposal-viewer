// components/admin/ads/swipe/SwipeFolderModal.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  title: string;
  initialName?: string;
  initialDescription?: string;
  /** When true the name field is locked — used for standard folders. */
  nameLocked?: boolean;
  onClose: () => void;
  onSave: (data: { name?: string; description?: string }) => Promise<void>;
};

export default function SwipeFolderModal({ title, initialName = '', initialDescription = '', nameLocked = false, onClose, onSave }: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      // When the name is locked (standard folder) omit it from the PATCH —
      // the server rejects any `name` field on standards even if unchanged.
      await onSave(
        nameLocked
          ? { description: description.trim() || '' }
          : { name: name.trim(), description: description.trim() || undefined }
      );
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
              autoFocus={!nameLocked}
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={nameLocked}
              className={`w-full px-3 py-2.5 border border-edge rounded-lg text-sm focus:ring-2 focus:ring-teal/20 outline-none ${
                nameLocked ? 'bg-surface text-faint cursor-not-allowed' : ''
              }`}
              placeholder="e.g. Direct To Offer"
            />
            {nameLocked && (
              <p className="mt-1 text-[11px] text-faint">Standard folder names can&apos;t be changed.</p>
            )}
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
