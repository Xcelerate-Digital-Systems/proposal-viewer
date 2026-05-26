// components/admin/ads/swipe/SwipeFolderModal.tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

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
    <Modal open onClose={onClose} title={title} size="md">
      <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
        <Modal.Body className="space-y-4">
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
              <p className="mt-1.5 text-2xs text-faint">
                Selected agencies can read and edit this folder&apos;s swipes. Only you can rename, delete, or change sharing.
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={saving} disabled={!name.trim()}>Save</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
