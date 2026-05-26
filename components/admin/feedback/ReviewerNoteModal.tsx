'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

interface ReviewerNoteModalProps {
  projectId: string;
  initialNote: string;
  initialShow: boolean;
  onClose: () => void;
  onSaved: (next: { reviewer_note: string | null; reviewer_note_show: boolean; reviewer_note_updated_at: string }) => void;
}

/**
 * Admin-side editor for the project-level reviewer note. Mirrors the
 * markup.io "Note to reviewers" modal — textarea + "show to reviewers" toggle.
 */
export default function ReviewerNoteModal({
  projectId,
  initialNote,
  initialShow,
  onClose,
  onSaved,
}: ReviewerNoteModalProps) {
  const toast = useToast();
  const [note, setNote] = useState(initialNote);
  const [show, setShow] = useState(initialShow);
  const [saving, setSaving] = useState(false);

  const dirty = note !== initialNote || show !== initialShow;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const trimmed = note.trim();
    const { error } = await supabase
      .from('review_projects')
      .update({
        reviewer_note: trimmed || null,
        reviewer_note_show: trimmed ? show : false,
        reviewer_note_updated_at: now,
        updated_at: now,
      })
      .eq('id', projectId);

    setSaving(false);

    if (error) {
      toast.error('Failed to save note');
      return;
    }
    onSaved({
      reviewer_note: trimmed || null,
      reviewer_note_show: trimmed ? show : false,
      reviewer_note_updated_at: now,
    });
    toast.success('Note saved');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Note to reviewers</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add details and any other important information reviewers may need to complete their feedback.
            </p>
          </div>
          <Button variant="ghost" size="sm" iconOnly leftIcon={X} onClick={onClose} aria-label="Close" />
        </div>

        <div className="px-6 pb-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            placeholder="Type here"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 text-sm text-ink placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <label className="flex items-center gap-2 mt-3 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              disabled={!note.trim()}
              className="w-4 h-4 rounded border-gray-300 text-teal focus:ring-teal/20 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            Show this note to reviewers when they open the markup
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} disabled={!dirty} onClick={handleSave}>
            Save note
          </Button>
        </div>
      </div>
    </div>
  );
}
