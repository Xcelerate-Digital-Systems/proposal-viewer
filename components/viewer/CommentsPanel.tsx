'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { ProposalComment } from '@/lib/supabase';

interface CommentsPanelProps {
  comments: ProposalComment[];
  currentPage: number;
  getPageName: (page: number) => string;
  onGoToPage: (page: number) => void;
  onSubmit: (authorName: string, content: string, pageNumber: number) => Promise<void>;
  onClose: () => void;
}

export default function CommentsPanel({
  comments,
  currentPage,
  getPageName,
  onGoToPage,
  onSubmit,
  onClose,
}: CommentsPanelProps) {
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !commentName.trim()) return;
    setSubmitting(true);
    await onSubmit(commentName, commentText, currentPage);
    setCommentText('');
    setSubmitting(false);
  };

  return (
    <div className="w-80 bg-[#141414] border-l border-[#2a2a2a] flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <h3 className="text-sm font-semibold text-white">Comments</h3>
        <button onClick={onClose} className="text-[#666] hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-[#555] text-center py-8">No comments yet</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{c.author_name}</span>
                {c.page_number && (
                  <button
                    onClick={() => onGoToPage(c.page_number!)}
                    className="text-xs text-[#ff6700] hover:text-[#ff8533]"
                  >
                    {getPageName(c.page_number)}
                  </button>
                )}
              </div>
              <p className="text-sm text-[#999]">{c.content}</p>
              <span className="text-xs text-[#555] mt-1 block">
                {new Date(c.created_at).toLocaleString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[#2a2a2a] space-y-2">
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