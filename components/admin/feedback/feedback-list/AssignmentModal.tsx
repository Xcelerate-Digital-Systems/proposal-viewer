'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, Search, UserPlus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import type { CommentWithItem } from './types';

interface Props {
  comment: CommentWithItem;
  companyId: string;
  currentMemberId: string | null;
  onAssign: (commentId: string, memberId: string, note: string) => Promise<void>;
  onToggleComplete: (commentId: string, completed: boolean) => Promise<void>;
  onRemove: (commentId: string) => Promise<void>;
  onClose: () => void;
  assigneeName?: string | null;
}

type TeamMemberOption = { id: string; name: string; email: string };

export default function AssignmentModal({
  comment,
  companyId,
  currentMemberId,
  onAssign,
  onToggleComplete,
  onRemove,
  onClose,
  assigneeName,
}: Props) {
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAssigned = !!comment.assigned_to;
  const isCompleted = !!comment.assignment_completed_at;
  const isAssignee = currentMemberId === comment.assigned_to;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name, email')
        .eq('company_id', companyId)
        .order('name');
      if (!cancelled) {
        setMembers(
          (data ?? []).map((m) => ({
            id: (m as { id: string }).id,
            name: ((m as { name: string | null }).name?.trim() || (m as { email: string }).email),
            email: (m as { email: string }).email,
          }))
        );
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const filtered = search
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
    : members;

  const handleAssign = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      await onAssign(comment.id, selectedId, note);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setSubmitting(true);
    try {
      await onRemove(comment.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md" title={isAssigned ? 'Assignment' : 'Assign comment'}>
      <Modal.Body>
        {isAssigned ? (
          <div className="space-y-4">
            <div className={`rounded-xl px-4 py-3.5 ${isCompleted ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {isCompleted ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <CircleDashed size={16} className="text-amber-600" />
                )}
                <span className={`text-sm font-semibold ${isCompleted ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {isCompleted ? 'Completed' : 'In progress'}
                </span>
              </div>
              <p className="text-sm text-prose mt-1">
                Assigned to <strong>{assigneeName || 'a team member'}</strong>
              </p>
              {comment.assignment_note && (
                <p className="text-sm text-dim mt-2 italic">{comment.assignment_note}</p>
              )}
            </div>

            <p className="text-xs text-faint line-clamp-2">{comment.content}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-faint line-clamp-2">{comment.content}</p>

            {/* Search */}
            <div>
              <label className="text-xs font-medium text-dim mb-1.5 block">Team member</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-edge-strong bg-white focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal">
                <Search size={14} className="text-faint shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search team members…"
                  autoFocus
                  className="flex-1 text-sm bg-transparent text-ink placeholder:text-faint focus:outline-none"
                />
              </div>
            </div>

            {/* Member list */}
            <div className="max-h-[200px] overflow-y-auto -mx-1 space-y-0.5">
              {loading && (
                <p className="text-sm text-faint text-center py-6">Loading…</p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-faint text-center py-6">No team members found</p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selectedId === m.id
                      ? 'bg-teal/8 ring-1 ring-teal/30'
                      : 'hover:bg-surface'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-teal/10 text-teal flex items-center justify-center text-xs font-semibold shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{m.name}</p>
                    <p className="text-xs text-faint truncate">{m.email}</p>
                  </div>
                  {selectedId === m.id && (
                    <CheckCircle2 size={16} className="text-teal shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Instructions */}
            {selectedId && (
              <div>
                <label className="text-xs font-medium text-dim mb-1.5 block">Instructions (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What needs to be fixed or changed…"
                  rows={3}
                  className="w-full text-sm rounded-lg border border-edge-strong px-3 py-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                />
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {isAssigned ? (
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              loading={submitting}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Remove assignment
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              {!isCompleted && (isAssignee || !!currentMemberId) && (
                <Button
                  size="sm"
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      await onToggleComplete(comment.id, true);
                      onClose();
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  loading={submitting}
                  leftIcon={CheckCircle2}
                >
                  Mark complete
                </Button>
              )}
              {isCompleted && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      await onToggleComplete(comment.id, false);
                      onClose();
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  loading={submitting}
                >
                  Reopen
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={!selectedId || submitting}
              loading={submitting}
              leftIcon={UserPlus}
            >
              Assign
            </Button>
          </div>
        )}
      </Modal.Footer>
    </Modal>
  );
}
