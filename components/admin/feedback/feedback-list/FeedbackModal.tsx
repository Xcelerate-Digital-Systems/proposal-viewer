'use client';

import { useState, useRef } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, CircleDashed, Clock, ExternalLink,
  ListTodo, MessageSquare, Paperclip, Search, Send, Trash2, UserPlus, X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatTimeAgo } from '@/lib/review-utils';
import { supabase, type FeedbackComment } from '@/lib/supabase';
import type { CommentTask, FeedbackCommentPriority } from '@/lib/types/feedback';
import { TYPE_ICONS, type CommentWithItem } from './types';
import { Button } from '@/components/ui/Button';
import PrioritySelector from '@/components/feedback/comments/PrioritySelector';
import CommentContent from '@/components/feedback/mentions/CommentContent';
import MentionEditor, { type MentionEditorHandle } from '@/components/feedback/mentions/MentionEditor';
import EmojiPicker from '@/components/feedback/comments/EmojiPicker';

type TeamMemberOption = { id: string; name: string; email: string };

interface Props {
  comment: CommentWithItem;
  allComments: FeedbackComment[];
  onClose: () => void;
  onToggleResolve: (comment: CommentWithItem, resolved: boolean) => void;
  onSubmitReply: (parent: CommentWithItem, content: string) => Promise<boolean>;
  onDelete: (comment: CommentWithItem) => void;
  memberNameMap?: Record<string, string>;
  currentMemberId?: string | null;
  onOpenTasks?: () => void;
  onQuickAssign?: (memberId: string, instructions: string) => Promise<void>;
  onToggleTaskComplete?: (commentId: string, taskId: string, completed: boolean) => Promise<void>;
  onRemoveTask?: (commentId: string, taskId: string) => Promise<void>;
  onPriorityChange?: (comment: CommentWithItem, priority: FeedbackCommentPriority) => void;
  onOpenTaskDetail?: (task: CommentTask) => void;
  teamMembers?: TeamMemberOption[];
  projectId?: string;
  participantsUrl?: string | null;
}

export default function FeedbackModal({
  comment,
  allComments,
  onClose,
  onToggleResolve,
  onSubmitReply,
  onDelete,
  memberNameMap,
  currentMemberId,
  onOpenTasks,
  onQuickAssign,
  onToggleTaskComplete,
  onRemoveTask,
  onPriorityChange,
  onOpenTaskDetail,
  teamMembers = [],
  projectId,
  participantsUrl,
}: Props) {
  const [showReplies, setShowReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const replyEditorRef = useRef<MentionEditorHandle | null>(null);
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').trim();
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSelectedId, setAssignSelectedId] = useState<string | null>(null);
  const [assignNote, setAssignNote] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const replies = allComments
    .filter((c) => c.parent_comment_id === comment.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const tasks = comment.tasks ?? [];
  const taskCount = tasks.length;
  const completedCount = tasks.filter((t) => !!t.completed_at).length;

  const replyEmpty = !stripHtml(replyText);
  const handleReplySubmit = async () => {
    if (replyEmpty || submittingReply) return;
    setSubmittingReply(true);
    const ok = await onSubmitReply(comment, replyText);
    setSubmittingReply(false);
    if (ok) {
      setReplyText('');
      setShowReplies(true);
    }
  };

  const TypeIcon = TYPE_ICONS[comment.item_type] || MessageSquare;

  return (
    <Modal open onClose={onClose} size="3xl">
      <Modal.Header>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {comment.thread_number && (
              <span className="px-2 py-0.5 rounded-lg bg-teal/10 text-xs font-bold text-teal">
                #{comment.thread_number}
              </span>
            )}
            <span className="text-sm text-dim truncate">
              Reported by <span className="font-medium text-prose">{comment.author_name}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon={Trash2}
              onClick={() => onDelete(comment)}
              aria-label="Delete"
              className="text-faint hover:text-red-600 hover:bg-red-50"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon={X}
              onClick={onClose}
              aria-label="Close"
            />
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        <div className="flex flex-col lg:flex-row">
            {/* Left — screenshot + comment + tasks + replies + composer */}
            <div className="flex-1 p-6 space-y-4 min-w-0">
              {comment.screenshot_url && (
                <div className="rounded-2xl border border-edge-strong overflow-hidden bg-surface">
                  <img
                    src={comment.screenshot_url}
                    alt="Screenshot"
                    className="w-full object-contain max-h-[400px]"
                  />
                </div>
              )}

              {comment.video_url && (
                <div className="rounded-2xl border border-edge-strong overflow-hidden bg-black">
                  <video
                    src={comment.video_url}
                    controls
                    preload="metadata"
                    className="w-full block max-h-[400px]"
                  />
                </div>
              )}

              <div>
                <CommentContent content={comment.content} className="text-ink leading-relaxed" />
              </div>

              {/* Inline task list */}
              {tasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-dim">Tasks ({completedCount}/{taskCount})</p>
                  {tasks.map((task) => {
                    const name = memberNameMap?.[task.assigned_to] || 'Team member';
                    const done = !!task.completed_at;
                    const isAssignee = currentMemberId === task.assigned_to;
                    return (
                      <div
                        key={task.id}
                        className={`rounded-lg border px-3 py-2 text-xs ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} ${onOpenTaskDetail ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
                        onClick={() => onOpenTaskDetail?.(task)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {done ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" /> : <CircleDashed size={13} className="text-amber-600 shrink-0" />}
                            <span className={`font-medium truncate ${done ? 'text-emerald-800' : 'text-amber-800'}`}>{name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!done && (isAssignee || !!currentMemberId) && onToggleTaskComplete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleTaskComplete(comment.id, task.id, true); }}
                                className="text-2xs font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
                              >
                                Complete
                              </button>
                            )}
                            {done && onToggleTaskComplete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleTaskComplete(comment.id, task.id, false); }}
                                className="text-2xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors"
                              >
                                Reopen
                              </button>
                            )}
                            {onRemoveTask && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onRemoveTask(comment.id, task.id); }}
                                className="p-0.5 rounded text-faint hover:text-red-500 transition-colors"
                                title="Remove task"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        {task.instructions && (
                          <p className={`mt-1 ${done ? 'text-emerald-700' : 'text-amber-700'}`}>{task.instructions}</p>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {task.attachments.map((att, i) => {
                              const url = supabase.storage.from('company-assets').getPublicUrl(att.path).data.publicUrl;
                              return (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} hover:opacity-80 transition-opacity`}>
                                  <Paperclip size={9} />
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

              {replies.length > 0 && (
                <div className="border-t border-edge pt-4">
                  <button
                    onClick={() => setShowReplies(!showReplies)}
                    className="flex items-center gap-1.5 text-sm font-medium text-dim hover:text-prose transition-colors mb-3"
                  >
                    {showReplies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                  </button>

                  {showReplies && (
                    <div className="space-y-3 pl-4 border-l-2 border-edge">
                      {replies.map((reply) => (
                        <div key={reply.id} className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-prose">{reply.author_name}</span>
                            <span className="text-xs text-faint">{formatTimeAgo(reply.created_at)}</span>
                          </div>
                          <CommentContent content={reply.content} className="text-prose leading-relaxed" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reply composer — full width */}
              <div className="border-t border-edge pt-4">
                <div className="flex items-center gap-1 rounded-lg border border-edge-strong focus-within:ring-2 focus-within:ring-teal/20 focus-within:border-teal px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <MentionEditor
                      value={replyText}
                      onChange={setReplyText}
                      placeholder="Reply to this feedback…"
                      submitOnEnter
                      onSubmit={() => { if (!replyEmpty) handleReplySubmit(); }}
                      participantsUrl={participantsUrl ?? null}
                      apiRef={replyEditorRef}
                      className="w-full text-sm text-ink"
                    />
                  </div>
                  <EmojiPicker onSelect={(emoji) => replyEditorRef.current?.insertText(emoji)} />
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    loading={submittingReply}
                    disabled={replyEmpty || submittingReply}
                    leftIcon={Send}
                    onClick={handleReplySubmit}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            </div>

            {/* Right — metadata sidebar */}
            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-edge p-6 bg-surface/50 shrink-0 space-y-5">
              <div className="text-xs text-faint">
                {new Date(comment.created_at).toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {', '}
                {new Date(comment.created_at).toLocaleTimeString('en-AU', {
                  hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </div>

              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Status</p>
                <button
                  onClick={() => onToggleResolve(comment, !comment.resolved)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    comment.resolved
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {comment.resolved ? (
                    <><CheckCircle2 size={12} /> Resolved</>
                  ) : (
                    <><Clock size={12} /> Open</>
                  )}
                </button>
              </div>

              {/* Priority */}
              {onPriorityChange && (
                <div>
                  <p className="text-xs font-medium text-dim mb-1.5">Priority</p>
                  <PrioritySelector
                    value={comment.priority || 'none'}
                    onChange={(p) => onPriorityChange(comment, p)}
                    compact={false}
                  />
                </div>
              )}

              {/* Tasks section */}
              {(onQuickAssign || onOpenTasks) && (
                <div>
                  <p className="text-xs font-medium text-dim mb-1.5">Tasks</p>
                  {taskCount > 0 && (
                    <button
                      onClick={onOpenTasks}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 mb-2 ${
                        completedCount === taskCount
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <ListTodo size={12} />
                      {completedCount}/{taskCount} done
                    </button>
                  )}
                  {!showAssignForm ? (
                    <Button
                      size="sm"
                      onClick={() => { setShowAssignForm(true); setAssignSearch(''); setAssignSelectedId(null); setAssignNote(''); }}
                      leftIcon={UserPlus}
                    >
                      Assign
                    </Button>
                  ) : (
                    <div className="space-y-2 border border-edge rounded-xl p-3 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink">Assign to team member</span>
                        <button onClick={() => setShowAssignForm(false)} className="p-0.5 rounded text-faint hover:text-prose">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warm-dark">
                        <Search size={13} className="text-faint shrink-0" />
                        <input
                          type="text"
                          value={assignSearch}
                          onChange={(e) => setAssignSearch(e.target.value)}
                          placeholder="Search team…"
                          autoFocus
                          className="flex-1 text-xs bg-transparent text-ink placeholder:text-faint focus:outline-none"
                        />
                      </div>
                      <div className="max-h-[140px] overflow-y-auto space-y-0.5 px-0.5">
                        {(() => {
                          const q = assignSearch.toLowerCase();
                          const matches = teamMembers.filter((m) =>
                            !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
                          );
                          if (matches.length === 0) return <p className="text-xs text-faint text-center py-3">No team members found</p>;
                          return matches.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setAssignSelectedId(assignSelectedId === m.id ? null : m.id)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                                assignSelectedId === m.id ? 'bg-teal/8 ring-1 ring-teal/20' : 'hover:bg-surface'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-2xs font-semibold shrink-0">
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-ink truncate">{m.name}</p>
                                <p className="text-2xs text-faint truncate">{m.email}</p>
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                      {assignSelectedId && (
                        <div className="space-y-2 pt-1 border-t border-edge-subtle">
                          <textarea
                            value={assignNote}
                            onChange={(e) => setAssignNote(e.target.value)}
                            placeholder="Instructions (optional)…"
                            rows={4}
                            className="w-full text-sm rounded-lg border border-edge-strong px-3 py-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                          />
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!assignSelectedId || assignSubmitting || !onQuickAssign) return;
                              setAssignSubmitting(true);
                              try {
                                await onQuickAssign(assignSelectedId, assignNote);
                                setShowAssignForm(false);
                              } finally { setAssignSubmitting(false); }
                            }}
                            disabled={assignSubmitting}
                            loading={assignSubmitting}
                            leftIcon={UserPlus}
                            fullWidth
                          >
                            Assign
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Item</p>
                {projectId ? (
                  <a
                    href={`/campaigns/${projectId}/assets/${comment.review_item_id}`}
                    className="flex items-center gap-2 text-sm text-teal hover:text-teal-hover transition-colors group"
                  >
                    <TypeIcon size={14} className="shrink-0" />
                    <span className="truncate group-hover:underline">{comment.item_title}</span>
                    <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-prose">
                    <TypeIcon size={14} className="text-faint shrink-0" />
                    <span className="truncate">{comment.item_title}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Type</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface text-prose capitalize">
                  {comment.comment_type?.replace('_', ' ') || 'general'}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Author</p>
                <p className="text-sm text-prose">{comment.author_name}</p>
                {comment.author_email && (
                  <p className="text-xs text-faint mt-0.5">{comment.author_email}</p>
                )}
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-surface text-dim capitalize">
                  {comment.author_type}
                </span>
              </div>

              {comment.item_url && (
                <div>
                  <p className="text-xs font-medium text-dim mb-1.5">Page</p>
                  <a
                    href={comment.item_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-teal hover:text-teal-hover transition-colors truncate max-w-full"
                  >
                    <ExternalLink size={11} className="shrink-0" />
                    <span className="truncate">{comment.item_url}</span>
                  </a>
                </div>
              )}

              {comment.resolved && comment.resolved_at && (
                <div>
                  <p className="text-xs font-medium text-dim mb-1.5">Resolved</p>
                  <p className="text-xs text-faint">
                    {new Date(comment.resolved_at).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
      </Modal.Body>
    </Modal>
  );
}
