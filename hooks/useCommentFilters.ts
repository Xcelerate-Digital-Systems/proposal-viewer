// hooks/useCommentFilters.ts
'use client';

import { useMemo, useCallback } from 'react';
import { type ReviewComment } from '@/lib/supabase';

/**
 * Derives filtered comment lists for a selected item from the full comments array.
 * Replaces identical filtering logic duplicated across review/project/admin item pages.
 */
export function useCommentFilters(comments: ReviewComment[], selectedItemId: string | null) {
  const itemComments = useMemo(
    () => comments.filter((c) => c.review_item_id === selectedItemId),
    [comments, selectedItemId]
  );

  const topLevelComments = useMemo(
    () => itemComments.filter((c) => !c.parent_comment_id),
    [itemComments]
  );

  const getReplies = useCallback(
    (parentId: string) => itemComments.filter((c) => c.parent_comment_id === parentId),
    [itemComments]
  );

  const unresolvedComments = useMemo(
    () => topLevelComments.filter((c) => !c.resolved),
    [topLevelComments]
  );

  const resolvedComments = useMemo(
    () => topLevelComments.filter((c) => c.resolved),
    [topLevelComments]
  );

  const pinComments = useMemo(
    () => topLevelComments.filter(
      (c) => c.comment_type === 'pin' && c.pin_x != null && c.pin_y != null
    ),
    [topLevelComments]
  );

  return {
    itemComments,
    topLevelComments,
    getReplies,
    unresolvedComments,
    resolvedComments,
    pinComments,
  };
}