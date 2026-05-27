'use client';

import { useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, ExternalLink, MessageSquare,
  Send, Trash2, X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatTimeAgo } from '@/lib/review-utils';
import type { FeedbackComment } from '@/lib/supabase';
import { TYPE_ICONS, type CommentWithItem } from './types';
import { Button } from '@/components/ui/Button';

interface Props {
  comment: CommentWithItem;
  /** All comments for the project — used to render the reply thread. */
  allComments: FeedbackComment[];
  onClose: () => void;
  onToggleResolve: (comment: CommentWithItem, resolved: boolean) => void;
  /** Returns true on success so the composer can clear/collapse. */
  onSubmitReply: (parent: CommentWithItem, content: string) => Promise<boolean>;
  onDelete: (comment: CommentWithItem) => void;
}

export default function FeedbackModal({
  comment,
  allComments,
  onClose,
  onToggleResolve,
  onSubmitReply,
  onDelete,
}: Props) {
  const [showReplies, setShowReplies] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const replies = allComments
    .filter((c) => c.parent_comment_id === comment.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
    <Modal open onClose={onClose} size="xl">
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
            {/* Left — screenshot + comment + replies + composer */}
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
                <p className="text-xs text-faint mt-2 italic">No description</p>
              </div>

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

              {/* Reply composer */}
              <div className="border-t border-edge pt-4">
                <div className="flex items-end gap-2">
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
                    rows={2}
                    className="flex-1 px-3 py-2 border border-edge-strong rounded-lg text-sm text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal resize-none"
                  />
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
            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-edge p-6 bg-surface/50 shrink-0 space-y-5">
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
                    <>
                      <CheckCircle2 size={12} />
                      Resolved
                    </>
                  ) : (
                    <>
                      <Clock size={12} />
                      Open
                    </>
                  )}
                </button>
              </div>

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
