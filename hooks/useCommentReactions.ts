// hooks/useCommentReactions.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedbackCommentReaction } from '@/lib/supabase';

interface UseCommentReactionsOptions {
  /** Display name posted as author_name for new reactions (null = guest hasn't named themselves yet) */
  currentUserName: string | null;
  /** Authenticated user id, if available — preferred match for toggling */
  currentUserId?: string | null;
  /** Skip fetch when false (e.g. comment thread closed) */
  enabled?: boolean;
  /** Share token for public viewer auth (admin path uses authFetch instead) */
  shareToken?: string | null;
}

interface UseCommentReactionsResult {
  reactions: FeedbackCommentReaction[];
  loading: boolean;
  toggle: (emoji: string) => Promise<void>;
}

/**
 * Lazy-fetch reactions for a single comment and provide an optimistic toggle.
 */
export function useCommentReactions(
  commentId: string,
  { currentUserName, currentUserId, enabled = true, shareToken }: UseCommentReactionsOptions
): UseCommentReactionsResult {
  const [reactions, setReactions] = useState<FeedbackCommentReaction[]>([]);
  const [loading, setLoading] = useState(false);
  // Track last server-confirmed state for rollback, not the optimistic snapshot.
  const confirmedRef = useRef<FeedbackCommentReaction[]>([]);

  const buildUrl = useCallback(
    (base: string) => shareToken ? `${base}?share_token=${encodeURIComponent(shareToken)}` : base,
    [shareToken]
  );

  const doFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      if (shareToken) return fetch(input, init);
      const { authFetch } = await import('@/lib/auth-fetch');
      return authFetch(input, init);
    },
    [shareToken]
  );

  useEffect(() => {
    if (!enabled || !commentId) return;
    let cancelled = false;
    setLoading(true);
    doFetch(buildUrl(`/api/review-comments/${commentId}/reactions`))
      .then((r) => (r.ok ? r.json() : { reactions: [] }))
      .then((data) => {
        if (!cancelled) {
          const fetched = data.reactions || [];
          confirmedRef.current = fetched;
          setReactions(fetched);
        }
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
  }, [commentId, enabled, buildUrl, doFetch]);

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

      const rollbackState = confirmedRef.current;
      if (existing) {
        setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      } else {
        const placeholder: FeedbackCommentReaction = {
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
        const res = await doFetch(buildUrl(`/api/review-comments/${commentId}/reactions`), {
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
          setReactions((prev) => {
            const updated = [
              ...prev.filter(
                (r) => !(r.emoji === emoji && r.id.startsWith('optimistic-'))
              ),
              data.reaction,
            ];
            confirmedRef.current = updated;
            return updated;
          });
        } else if (data.action === 'removed') {
          // Sync confirmed state with the optimistic removal.
          confirmedRef.current = confirmedRef.current.filter((r) => r.id !== existing?.id);
        }
      } catch {
        setReactions(rollbackState);
      }
    },
    [commentId, currentUserName, currentUserId, reactions, doFetch, buildUrl]
  );

  return { reactions, loading, toggle };
}
