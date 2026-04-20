// hooks/useCommentReactions.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReviewCommentReaction } from '@/lib/supabase';

interface UseCommentReactionsOptions {
  /** Display name posted as author_name for new reactions (null = guest hasn't named themselves yet) */
  currentUserName: string | null;
  /** Authenticated user id, if available — preferred match for toggling */
  currentUserId?: string | null;
  /** Skip fetch when false (e.g. comment thread closed) */
  enabled?: boolean;
}

interface UseCommentReactionsResult {
  reactions: ReviewCommentReaction[];
  loading: boolean;
  toggle: (emoji: string) => Promise<void>;
}

/**
 * Lazy-fetch reactions for a single comment and provide an optimistic toggle.
 */
export function useCommentReactions(
  commentId: string,
  { currentUserName, currentUserId, enabled = true }: UseCommentReactionsOptions
): UseCommentReactionsResult {
  const [reactions, setReactions] = useState<ReviewCommentReaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !commentId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/review-comments/${commentId}/reactions`)
      .then((r) => (r.ok ? r.json() : { reactions: [] }))
      .then((data) => {
        if (!cancelled) setReactions(data.reactions || []);
      })
      .catch(() => {
        if (!cancelled) setReactions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [commentId, enabled]);

  const toggle = useCallback(
    async (emoji: string) => {
      if (!currentUserName) return;

      // Optimistic update: figure out whether the current user already reacted with this emoji.
      const existing = reactions.find(
        (r) =>
          r.emoji === emoji &&
          ((currentUserId && r.author_user_id === currentUserId) ||
            r.author_name === currentUserName)
      );

      const optimisticPrev = reactions;
      if (existing) {
        setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      } else {
        const placeholder: ReviewCommentReaction = {
          id: `optimistic-${Date.now()}`,
          review_comment_id: commentId,
          emoji,
          author_name: currentUserName,
          author_user_id: currentUserId ?? null,
          created_at: new Date().toISOString(),
        };
        setReactions((prev) => [...prev, placeholder]);
      }

      try {
        const res = await fetch(`/api/review-comments/${commentId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emoji,
            author_name: currentUserName,
            author_user_id: currentUserId ?? null,
          }),
        });
        if (!res.ok) throw new Error('Reaction toggle failed');
        const data = await res.json();
        if (data.action === 'added' && data.reaction) {
          // Replace any optimistic placeholder for this emoji with the real row.
          setReactions((prev) => [
            ...prev.filter(
              (r) => !(r.emoji === emoji && r.id.startsWith('optimistic-'))
            ),
            data.reaction,
          ]);
        }
        // 'removed' — already reflected in optimistic update.
      } catch {
        // Roll back on failure.
        setReactions(optimisticPrev);
      }
    },
    [commentId, currentUserName, currentUserId, reactions]
  );

  return { reactions, loading, toggle };
}
