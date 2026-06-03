'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleDashed, Paperclip, Search, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import type { CommentTask, CommentTaskAttachment } from '@/lib/types/feedback';

type TeamMemberOption = { id: string; name: string; email: string };

interface Props {
  commentId: string;
  commentContent: string;
  companyId: string;
  currentMemberId: string | null;
  existingTasks: CommentTask[];
  teamMembers: TeamMemberOption[];
  memberNameMap: Record<string, string>;
  onCreateTask: (commentId: string, memberId: string, instructions: string, attachments: CommentTaskAttachment[]) => Promise<void>;
  onToggleComplete: (commentId: string, taskId: string, completed: boolean) => Promise<void>;
  onRemoveTask: (commentId: string, taskId: string) => Promise<void>;
  onClose: () => void;
}

export default function TaskModal({
  commentId,
  commentContent,
  companyId,
  currentMemberId,
  existingTasks,
  teamMembers,
  memberNameMap,
  onCreateTask,
  onToggleComplete,
  onRemoveTask,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [attachments, setAttachments] = useState<CommentTaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(existingTasks.length === 0);
  const fileRef = useRef<HTMLInputElement>(null);

  const alreadyAssigned = new Set(existingTasks.map((t) => t.assigned_to));

  const filtered = teamMembers.filter((m) => {
    if (alreadyAssigned.has(m.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newAttachments: CommentTaskAttachment[] = [];
    for (const file of Array.from(files)) {
      const path = `task-attachments/${companyId}/${commentId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('company-assets').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (!error) {
        newAttachments.push({ path, name: file.name, size: file.size, type: file.type });
      }
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    setUploading(false);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      await onCreateTask(commentId, selectedId, instructions, attachments);
      setSelectedId(null);
      setInstructions('');
      setAttachments([]);
      setShowAddForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Tasks">
      <Modal.Body>
        <div className="space-y-4">
          {/* Comment preview */}
          <div className="rounded-lg bg-surface px-3 py-2">
            <p className="text-xs text-faint line-clamp-2">{commentContent}</p>
          </div>

          {/* Existing tasks */}
          {existingTasks.length > 0 && (
            <div className="space-y-2">
              {existingTasks.map((task) => {
                const name = memberNameMap[task.assigned_to] || 'Team member';
                const done = !!task.completed_at;
                const isAssignee = currentMemberId === task.assigned_to;
                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border px-4 py-3 ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {done ? (
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        ) : (
                          <CircleDashed size={16} className="text-amber-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${done ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!done && (isAssignee || !!currentMemberId) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleComplete(commentId, task.id, true)}
                            className="text-emerald-700 hover:bg-emerald-100 text-xs"
                          >
                            Complete
                          </Button>
                        )}
                        {done && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleComplete(commentId, task.id, false)}
                            className="text-amber-700 hover:bg-amber-100 text-xs"
                          >
                            Reopen
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          leftIcon={Trash2}
                          onClick={() => onRemoveTask(commentId, task.id)}
                          className="text-faint hover:text-red-600 hover:bg-red-50"
                          aria-label="Remove task"
                        />
                      </div>
                    </div>
                    {task.instructions && (
                      <p className={`text-xs mt-1.5 ${done ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {task.instructions}
                      </p>
                    )}
                    {task.attachments && task.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {task.attachments.map((att, i) => {
                          const url = supabase.storage.from('company-assets').getPublicUrl(att.path).data.publicUrl;
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${done ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'} transition-colors`}
                            >
                              <Paperclip size={10} />
                              {att.name}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add task form */}
          {showAddForm ? (
            <div className="space-y-3 border border-edge rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Add task</p>
                {existingTasks.length > 0 && (
                  <button onClick={() => setShowAddForm(false)} className="p-0.5 text-faint hover:text-prose">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search */}
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

              {/* Member list */}
              <div className="max-h-[180px] overflow-y-auto -mx-1 space-y-0.5">
                {filtered.length === 0 && (
                  <p className="text-sm text-faint text-center py-4">
                    {teamMembers.length === alreadyAssigned.size ? 'All team members have tasks' : 'No matches'}
                  </p>
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

              {/* Instructions + attachments */}
              {selectedId && (
                <>
                  <div>
                    <label className="text-xs font-medium text-dim mb-1.5 block">Instructions (optional)</label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="What needs to be fixed or changed…"
                      rows={3}
                      className="w-full text-sm rounded-lg border border-edge-strong px-3 py-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                    />
                  </div>

                  {/* Attachments */}
                  <div>
                    <label className="text-xs font-medium text-dim mb-1.5 block">Attachments</label>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {attachments.map((att, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface text-xs text-prose border border-edge">
                            <Paperclip size={10} className="text-faint" />
                            <span className="truncate max-w-[120px]">{att.name}</span>
                            <button onClick={() => removeAttachment(i)} className="p-0.5 text-faint hover:text-red-500">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-dim border border-dashed border-edge-hover hover:border-teal hover:text-teal transition-colors disabled:opacity-50"
                    >
                      <Upload size={12} />
                      {uploading ? 'Uploading…' : 'Add files'}
                    </button>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={!selectedId || submitting}
                    loading={submitting}
                    leftIcon={UserPlus}
                    fullWidth
                  >
                    Create task
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={UserPlus}
              onClick={() => setShowAddForm(true)}
            >
              Add another task
            </Button>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex justify-end w-full">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
