'use client';

import { useRef, useState } from 'react';
import {
  CheckCircle2, CircleDashed, Clock, ExternalLink, MessageSquare,
  Paperclip, Search, Trash2, Upload, UserPlus, X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { formatTimeAgo } from '@/lib/review-utils';
import type { CommentTask, CommentTaskAttachment } from '@/lib/types/feedback';
import { TYPE_ICONS, FALLBACK_TYPE_ICON } from './types';

type TeamMemberOption = { id: string; name: string; email: string };

interface TaskDetailModalProps {
  task: CommentTask;
  commentContent: string;
  commentAuthorName: string;
  commentCreatedAt: string;
  commentScreenshotUrl?: string | null;
  commentVideoUrl?: string | null;
  commentThreadNumber?: number | null;
  itemTitle?: string;
  itemType?: string;
  itemUrl?: string | null;
  projectId?: string;
  reviewItemId?: string;
  companyId: string;
  currentMemberId: string | null;
  memberNameMap: Record<string, string>;
  teamMembers: TeamMemberOption[];
  existingTasks: CommentTask[];
  onToggleComplete: (commentId: string, taskId: string, completed: boolean) => Promise<void>;
  onRemoveTask: (commentId: string, taskId: string) => Promise<void>;
  onCreateTask: (commentId: string, memberId: string, instructions: string, attachments: CommentTaskAttachment[]) => Promise<void>;
  onClose: () => void;
}

export default function TaskDetailModal({
  task,
  commentContent,
  commentAuthorName,
  commentCreatedAt,
  commentScreenshotUrl,
  commentVideoUrl,
  commentThreadNumber,
  itemTitle,
  itemType,
  itemUrl,
  projectId,
  reviewItemId,
  companyId,
  currentMemberId,
  memberNameMap,
  teamMembers,
  existingTasks,
  onToggleComplete,
  onRemoveTask,
  onCreateTask,
  onClose,
}: TaskDetailModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [attachments, setAttachments] = useState<CommentTaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const done = !!task.completed_at;
  const assigneeName = memberNameMap[task.assigned_to] || 'Team member';
  const assignedByName = task.assigned_by ? (memberNameMap[task.assigned_by] || 'Team member') : null;
  const isAssignee = currentMemberId === task.assigned_to;
  const TypeIcon = TYPE_ICONS[itemType || ''] || FALLBACK_TYPE_ICON;

  const otherTasks = existingTasks.filter((t) => t.id !== task.id);
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
      const path = `task-attachments/${companyId}/${task.comment_id}/${Date.now()}-${file.name}`;
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
      await onCreateTask(task.comment_id, selectedId, instructions, attachments);
      setSelectedId(null);
      setInstructions('');
      setAttachments([]);
      setShowAddForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="3xl">
      <Modal.Body className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Left — task hero + comment context */}
          <div className="flex-1 min-w-0">
            {/* Task hero */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {commentThreadNumber && (
                    <span className="px-2.5 py-1 rounded-lg bg-teal/10 text-sm font-bold text-teal shrink-0">
                      #{commentThreadNumber}
                    </span>
                  )}
                  <h2 className="text-lg font-semibold text-ink truncate">Task</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  leftIcon={X}
                  onClick={onClose}
                  aria-label="Close"
                />
              </div>

              {/* Status banner */}
              <div
                className={`rounded-xl p-4 ${
                  done
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-amber-50 border border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold shrink-0 ${
                      done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {assigneeName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${done ? 'text-emerald-900' : 'text-amber-900'}`}>
                        {assigneeName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                          done ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {done ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
                          {done ? 'Completed' : 'In progress'}
                        </span>
                        <span className="text-xs text-faint">·</span>
                        <span className={`text-xs ${done ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {formatTimeAgo(task.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!done && (isAssignee || !!currentMemberId) && (
                      <Button
                        size="sm"
                        onClick={() => onToggleComplete(task.comment_id, task.id, true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        leftIcon={CheckCircle2}
                      >
                        Complete
                      </Button>
                    )}
                    {done && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onToggleComplete(task.comment_id, task.id, false)}
                      >
                        Reopen
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      leftIcon={Trash2}
                      onClick={() => onRemoveTask(task.comment_id, task.id)}
                      className="text-faint hover:text-red-600 hover:bg-red-50"
                      aria-label="Remove task"
                    />
                  </div>
                </div>

                {/* Instructions */}
                {task.instructions && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <p className="text-xs font-medium text-current/50 mb-1">Instructions</p>
                    <p className={`text-sm leading-relaxed ${done ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {task.instructions}
                    </p>
                  </div>
                )}

                {/* Attachments */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <p className="text-xs font-medium text-current/50 mb-1.5">Attachments</p>
                    <div className="flex flex-wrap gap-1.5">
                      {task.attachments.map((att, i) => {
                        const url = supabase.storage.from('company-assets').getPublicUrl(att.path).data.publicUrl;
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              done
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                          >
                            <Paperclip size={11} />
                            {att.name}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Other assignees on this comment */}
              {otherTasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-dim mb-2">
                    Other assignees ({otherTasks.filter((t) => !!t.completed_at).length}/{otherTasks.length} done)
                  </p>
                  <div className="space-y-1.5">
                    {otherTasks.map((t) => {
                      const name = memberNameMap[t.assigned_to] || 'Team member';
                      const tDone = !!t.completed_at;
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                            tDone ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
                          }`}
                        >
                          {tDone ? (
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                          ) : (
                            <CircleDashed size={13} className="text-amber-600 shrink-0" />
                          )}
                          <span className={`font-medium ${tDone ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {name}
                          </span>
                          {t.instructions && (
                            <span className={`truncate ${tDone ? 'text-emerald-600' : 'text-amber-600'}`}>
                              — {t.instructions}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add another assignee */}
              {!showAddForm ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={UserPlus}
                  onClick={() => setShowAddForm(true)}
                >
                  Assign another person
                </Button>
              ) : (
                <div className="space-y-3 border border-edge rounded-xl p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">Add assignee</p>
                    <button onClick={() => setShowAddForm(false)} className="p-0.5 text-faint hover:text-prose">
                      <X size={14} />
                    </button>
                  </div>

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

                  <div className="max-h-[180px] overflow-y-auto space-y-0.5 px-0.5">
                    {filtered.length === 0 && (
                      <p className="text-sm text-faint text-center py-4">
                        {teamMembers.length === alreadyAssigned.size ? 'All team members assigned' : 'No matches'}
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

                  {selectedId && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-dim mb-1.5 block">Instructions (optional)</label>
                        <textarea
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          placeholder="What needs to be fixed or changed…"
                          rows={4}
                          className="w-full text-sm rounded-lg border border-edge-strong px-3 py-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                        />
                      </div>

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
                        Assign
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Comment context — below the task */}
            <div className="border-t border-edge p-6 bg-surface/30">
              <p className="text-xs font-medium text-dim mb-3">Original comment</p>

              {commentScreenshotUrl && (
                <div className="rounded-xl border border-edge-strong overflow-hidden bg-surface mb-3">
                  <img
                    src={commentScreenshotUrl}
                    alt="Screenshot"
                    className="w-full object-contain max-h-[300px]"
                  />
                </div>
              )}

              {commentVideoUrl && (
                <div className="rounded-xl border border-edge-strong overflow-hidden bg-black mb-3">
                  <video
                    src={commentVideoUrl}
                    controls
                    preload="metadata"
                    className="w-full block max-h-[300px]"
                  />
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-edge text-prose flex items-center justify-center text-xs font-semibold shrink-0">
                  {commentAuthorName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-ink">{commentAuthorName}</span>
                    <span className="text-xs text-faint">{formatTimeAgo(commentCreatedAt)}</span>
                  </div>
                  <p className="text-sm text-prose leading-relaxed">{commentContent}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar — metadata */}
          <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-edge p-6 bg-surface/50 shrink-0 space-y-5">
            <div>
              <p className="text-xs font-medium text-dim mb-1.5">Status</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                done
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {done ? <><CheckCircle2 size={12} /> Completed</> : <><Clock size={12} /> Open</>}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-dim mb-1.5">Assignee</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-2xs font-semibold shrink-0">
                  {assigneeName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-prose">{assigneeName}</span>
              </div>
            </div>

            {assignedByName && (
              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Assigned by</p>
                <span className="text-sm text-prose">{assignedByName}</span>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-dim mb-1.5">Created</p>
              <p className="text-xs text-faint">
                {new Date(task.created_at).toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {', '}
                {new Date(task.created_at).toLocaleTimeString('en-AU', {
                  hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </p>
            </div>

            {done && task.completed_at && (
              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Completed</p>
                <p className="text-xs text-faint">
                  {new Date(task.completed_at).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            )}

            {itemTitle && (
              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Asset</p>
                {projectId && reviewItemId ? (
                  <a
                    href={`/campaigns/${projectId}/assets/${reviewItemId}`}
                    className="flex items-center gap-2 text-sm text-teal hover:text-teal-hover transition-colors group"
                  >
                    <TypeIcon size={14} className="shrink-0" />
                    <span className="truncate group-hover:underline">{itemTitle}</span>
                    <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-prose">
                    <TypeIcon size={14} className="text-faint shrink-0" />
                    <span className="truncate">{itemTitle}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
