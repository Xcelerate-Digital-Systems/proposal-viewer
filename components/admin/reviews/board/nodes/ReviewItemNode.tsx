// components/admin/reviews/board/nodes/ReviewItemNode.tsx
'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { supabase, type ReviewItem } from '@/lib/supabase';
import { NODE_LAYOUTS, type NodeItemProps } from './nodeConfig';

// Type-specific node components
import WebsiteNode from './WebsiteNode';
import ImageNode from './ImageNode';
import VideoNode from './VideoNode';
import EmailNode from './EmailNode';
import SMSNode from './SMSNode';
import FacebookNode from './FacebookNode';

/* ─── Node data interface ──────────────────────────────────────── */

export interface ReviewItemNodeData extends Record<string, unknown> {
  item: ReviewItem;
  readOnly?: boolean;
  onNavigate?: (itemId: string) => void;
}

/* ─── Component map ────────────────────────────────────────────── */

const NODE_COMPONENTS: Record<string, React.ComponentType<NodeItemProps>> = {
  webpage: WebsiteNode,
  image: ImageNode,
  video: VideoNode,
  email: EmailNode,
  sms: SMSNode,
  ad: FacebookNode,
};

/* ─── Dispatcher ───────────────────────────────────────────────── */

function ReviewItemNodeComponent({ data, selected }: NodeProps) {
  const { item, readOnly, onNavigate } = data as ReviewItemNodeData;
  const [commentCount, setCommentCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  const fetchCommentStats = useCallback(async () => {
    const { data: comments } = await supabase
      .from('review_comments')
      .select('resolved')
      .eq('review_item_id', item.id)
      .is('parent_comment_id', null);

    if (comments) {
      setCommentCount(comments.length);
      setUnresolvedCount(comments.filter((c: { resolved: boolean }) => !c.resolved).length);
    }
  }, [item.id]);

  useEffect(() => {
    fetchCommentStats();
  }, [fetchCommentStats]);

  // Pick the right component (falls back to WebsiteNode for unknown types)
  const Component = NODE_COMPONENTS[item.type] || WebsiteNode;

  return (
    <Component
      item={item}
      selected={!!selected}
      readOnly={readOnly}
      commentCount={commentCount}
      unresolvedCount={unresolvedCount}
      onNavigate={onNavigate}
    />
  );
}

const ReviewItemNode = memo(ReviewItemNodeComponent);
ReviewItemNode.displayName = 'ReviewItemNode';

export default ReviewItemNode;