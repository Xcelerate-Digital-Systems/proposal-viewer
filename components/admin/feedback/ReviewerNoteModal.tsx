'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

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
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <h3 className="text-lg font-semibold text-ink">Note to reviewers</h3>
        <p className="text-sm text-muted mt-1">
          Add details and any other important information reviewers may need to complete their feedback.
        </p>
      </Modal.Header>
      <Modal.Body>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={6}
          placeholder="Type here"
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-sm text-ink placeholder-faint resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <label className="flex items-center gap-2 mt-3 text-sm text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            disabled={!note.trim()}
            className="w-4 h-4 rounded border-edge text-primary focus:ring-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          Show this note to reviewers when they open the markup
        </label>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" loading={saving} disabled={!dirty} onClick={handleSave}>Save note</Button>
      </Modal.Footer>
    </Modal>
  );
}
