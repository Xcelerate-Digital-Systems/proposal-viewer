// components/reviews/comments/ResolvedSection.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, RotateCcw } from 'lucide-react';
import type { ReviewComment } from '@/lib/supabase';

interface ResolvedSectionProps {
  comments: ReviewComment[];
  getReplies: (commentId: string) => ReviewComment[];
  /** 'admin' = shows Reopen button, 'client' = read-only */
  variant: 'admin' | 'client';
  /** Admin: unresolve callback */
  onUnresolve?: (commentId: string) => Promise<void>;
}

export default function ResolvedSection({
  comments,
  getReplies,
  variant,
  onUnresolve,
}: ResolvedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (comments.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Resolved ({comments.length})
      </button>
      {expanded && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 opacity-70">
              {c.comment_type === 'pin' && c.thread_number && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-4 h-4 rounded-full bg-gray-400 text-white flex items-center justify-center text-[9px] font-bold">
                    {c.thread_number}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">
                  {c.author_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-medium text-gray-500">{c.author_name}</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">{c.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-emerald-500" />
                      <span className="text-[10px] text-gray-400">
                        Resolved{c.resolved_by ? ` by ${c.resolved_by}` : ''}
                      </span>
                    </div>
                    {variant === 'admin' && onUnresolve && (
                      <button
                        onClick={() => onUnresolve(c.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-amber-600 transition-colors"
                      >
                        <RotateCcw size={9} />
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}