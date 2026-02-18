'use client';

import { useState } from 'react';
import { X, Send, CheckCircle2, CornerDownRight, ChevronDown, ChevronRight } from 'lucide-react';
import { ProposalComment } from '@/lib/supabase';

interface CommentsPanelProps {
  comments: ProposalComment[];
  currentPage: number;
  getPageName: (page: number) => string;
  onGoToPage: (page: number) => void;
  onSubmit: (authorName: string, content: string, pageNumber: number) => Promise<void>;
  onReply: (parentId: string, authorName: string, content: string) => Promise<void>;
  onResolve: (commentId: string, resolvedBy: string) => Promise<void>;
  onUnresolve: (commentId: string) => Promise<void>;
  onClose: () => void;
}

export default function CommentsPanel({
  comments,
  currentPage,
  getPageName,
  onGoToPage,
  onSubmit,
  onReply,
  onResolve,
  onUnresolve,
  onClose,
}: CommentsPanelProps) {
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyName, setReplyName] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  // Separate top-level comments from replies
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  const unresolvedComments = topLevelComments.filter((c) => !c.resolved_at);
  const resolvedComments = topLevelComments.filter((c) => c.resolved_at);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !commentName.trim()) return;
    setSubmitting(true);
    await onSubmit(commentName, commentText, currentPage);
    setCommentText('');
    setSubmitting(false);
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim() || !replyName.trim()) return;
    setReplySubmitting(true);
    await onReply(parentId, replyName, replyText);
    setReplyText('');
    setReplyingTo(null);
    setReplySubmitting(false);
  };

  const handleResolve = async (commentId: string) => {
    const name = commentName.trim() || 'Someone';
    await onResolve(commentId, name);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderComment = (comment: ProposalComment, isReply = false) => {
    const replies = getReplies(comment.id);
    const isResolved = !!comment.resolved_at;

    return (
      <div key={comment.id} className={isReply ? 'ml-4 mt-2' : ''}>
        <div
          className={`rounded-lg p-3 border transition-colors ${
            isResolved
              ? 'bg-[#1a1a1a]/50 border-[#2a2a2a]/50 opacity-60'
              : 'bg-[#1a1a1a] border-[#2a2a2a]'
          }`}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              {isReply && (
                <CornerDownRight size={12} className="text-[#555] shrink-0" />
              )}
              <span className="text-sm font-medium text-white">{comment.author_name}</span>
            </div>
            {!isReply && comment.page_number && (
              <button
                onClick={() => onGoToPage(comment.page_number!)}
                className="text-xs text-[#ff6700] hover:text-[#ff8533] transition-colors shrink-0"
              >
                {getPageName(comment.page_number)}
              </button>
            )}
          </div>

          {/* Content */}
          <p className="text-sm text-[#999] leading-relaxed">{comment.content}</p>

          {/* Footer row */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#555]">{formatDate(comment.created_at)}</span>

            {!isReply && (
              <div className="flex items-center gap-2">
                {/* Reply button */}
                {!isResolved && (
                  <button
                    onClick={() => {
                      setReplyingTo(replyingTo === comment.id ? null : comment.id);
                      setReplyName(commentName);
                    }}
                    className="text-xs text-[#666] hover:text-white transition-colors"
                  >
                    Reply
                  </button>
                )}

                {/* Resolve/unresolve */}
                {isResolved ? (
                  <button
                    onClick={() => onUnresolve(comment.id)}
                    className="flex items-center gap-1 text-xs text-emerald-500/60 hover:text-emerald-400 transition-colors"
                  >
                    <CheckCircle2 size={12} />
                    Resolved
                  </button>
                ) : (
                  <button
                    onClick={() => handleResolve(comment.id)}
                    className="flex items-center gap-1 text-xs text-[#666] hover:text-emerald-400 transition-colors"
                  >
                    <CheckCircle2 size={12} />
                    Resolve
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="space-y-2 mt-2">
            {replies.map((reply) => renderComment(reply, true))}
          </div>
        )}

        {/* Reply input */}
        {replyingTo === comment.id && (
          <div className="ml-4 mt-2 space-y-2">
            <input
              type="text"
              placeholder="Your name"
              value={replyName}
              onChange={(e) => setReplyName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[#0f0f0f] border border-[#2a2a2a] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply(comment.id);
                  }
                }}
                className="flex-1 px-2.5 py-1.5 rounded-md bg-[#0f0f0f] border border-[#2a2a2a] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
                autoFocus
              />
              <button
                onClick={() => handleReply(comment.id)}
                disabled={replySubmitting || !replyText.trim() || !replyName.trim()}
                className="px-2 py-1.5 bg-[#ff6700] text-white rounded-md hover:bg-[#e85d00] disabled:opacity-40 transition-colors"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 bg-[#141414] border-l border-[#2a2a2a] flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <h3 className="text-sm font-semibold text-white">
          Comments
          {unresolvedComments.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-[#666]">
              ({unresolvedComments.length})
            </span>
          )}
        </h3>
        <button onClick={onClose} className="text-[#666] hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* No comments state */}
        {topLevelComments.length === 0 && (
          <p className="text-sm text-[#555] text-center py-8">No comments yet</p>
        )}

        {/* Unresolved comments */}
        {unresolvedComments.map((c) => renderComment(c))}

        {/* Resolved comments (collapsible) */}
        {resolvedComments.length > 0 && (
          <div>
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="flex items-center gap-1.5 text-xs text-[#555] hover:text-[#999] transition-colors w-full py-2"
            >
              {showResolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {resolvedComments.length} resolved comment{resolvedComments.length !== 1 ? 's' : ''}
            </button>
            {showResolved && (
              <div className="space-y-3">
                {resolvedComments.map((c) => renderComment(c))}
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-[#2a2a2a] space-y-2">
        <input
          type="text"
          placeholder="Your name"
          value={commentName}
          onChange={(e) => setCommentName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6700]/50"
          />
          <button
            type="submit"
            disabled={submitting || !commentText.trim() || !commentName.trim()}
            className="px-3 py-2 bg-[#ff6700] text-white rounded-lg hover:bg-[#e85d00] disabled:opacity-40 transition-colors"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-xs text-[#555]">Commenting on: {getPageName(currentPage)}</p>
      </form>
    </div>
  );
}