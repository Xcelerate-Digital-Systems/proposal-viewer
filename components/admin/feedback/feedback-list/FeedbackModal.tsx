'use client';

import { useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, CircleDashed, Clock, ExternalLink,
  ListTodo, MessageSquare, Paperclip, Send, Trash2, UserPlus, X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatTimeAgo } from '@/lib/review-utils';
import { supabase, type FeedbackComment } from '@/lib/supabase';
import type { CommentTask } from '@/lib/types/feedback';
import { TYPE_ICONS, type CommentWithItem } from './types';
import { Button } from '@/components/ui/Button';

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
  onToggleTaskComplete?: (commentId: string, taskId: string, completed: boolean) => Promise<void>;
  onRemoveTask?: (commentId: string, taskId: string) => Promise<void>;
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
  onToggleTaskComplete,
  onRemoveTask,
}: Props) {
  const [showReplies, setShowReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const replies = allComments
    .filter((c) => c.parent_comment_id === comment.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const tasks = comment.tasks ?? [];
  const taskCount = tasks.length;
  const completedCount = tasks.filter((t) => !!t.completed_at).length;

  const handleReplySubmit = async () => {
    if (!replyText.trim() || submittingReply) return;
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
    <Modal open onClose={onClose} size="2xl">
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
                <p className="text-ink leading-relaxed">{comment.content}</p>
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
                        className={`rounded-lg border px-3 py-2 text-xs ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {done ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" /> : <CircleDashed size={13} className="text-amber-600 shrink-0" />}
                            <span className={`font-medium truncate ${done ? 'text-emerald-800' : 'text-amber-800'}`}>{name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!done && (isAssignee || !!currentMemberId) && onToggleTaskComplete && (
                              <button
                                onClick={() => onToggleTaskComplete(comment.id, task.id, true)}
                                className="text-2xs font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
                              >
                                Complete
                              </button>
                            )}
                            {done && onToggleTaskComplete && (
                              <button
                                onClick={() => onToggleTaskComplete(comment.id, task.id, false)}
                                className="text-2xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors"
                              >
                                Reopen
                              </button>
                            )}
                            {onRemoveTask && (
                              <button
                                onClick={() => onRemoveTask(comment.id, task.id)}
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
                          <p className="text-prose leading-relaxed">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reply composer — full width */}
              <div className="border-t border-edge pt-4">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleReplySubmit();
                    }
                  }}
                  placeholder="Reply to this feedback…"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-edge-strong rounded-lg text-sm text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    loading={submittingReply}
                    disabled={!replyText.trim() || submittingReply}
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

              {/* Tasks section */}
              {onOpenTasks && (
                <div>
                  <p className="text-xs font-medium text-dim mb-1.5">Tasks</p>
                  {taskCount > 0 ? (
                    <button
                      onClick={onOpenTasks}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${
                        completedCount === taskCount
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <ListTodo size={12} />
                      {completedCount}/{taskCount} done
                    </button>
                  ) : (
                    <button
                      onClick={onOpenTasks}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal hover:bg-teal-hover transition-colors"
                    >
                      <UserPlus size={12} />
                      Create task
                    </button>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Item</p>
                <div className="flex items-center gap-2 text-sm text-prose">
                  <TypeIcon size={14} className="text-faint shrink-0" />
                  <span className="truncate">{comment.item_title}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Type</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-prose capitalize">
                  {comment.comment_type?.replace('_', ' ') || 'general'}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-dim mb-1.5">Author</p>
                <p className="text-sm text-prose">{comment.author_name}</p>
                {comment.author_email && (
                  <p className="text-xs text-faint mt-0.5">{comment.author_email}</p>
                )}
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-dim capitalize">
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
