'use client';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { type FeedbackItem, type FeedbackStatus } from '@/lib/supabase';
import { type NodeItemProps } from './nodeConfig';
import { type CommentStats } from '../FeedbackBoardContext';

// Type-specific node components
import WebsiteNode from './WebsiteNode';
import ImageNode from './ImageNode';
import VideoNode from './VideoNode';
import EmailNode from './EmailNode';
import SMSNode from './SMSNode';
import FacebookNode from './FacebookNode';
import GoogleAdNode from './GoogleAdNode';
import PdfNode from './PdfNode';
import MetaLeadFormNode from './MetaLeadFormNode';

/* ─── Node data interface ──────────────────────────────────────── */

export interface ReviewItemNodeData extends Record<string, unknown> {
  item: FeedbackItem;
  readOnly?: boolean;
  commentStats?: CommentStats;
  onNavigate?: (itemId: string) => void;
  onUpdateStatus?: (itemId: string, status: FeedbackStatus) => void | Promise<void>;
}

/* ─── Component map ────────────────────────────────────────────── */

const NODE_COMPONENTS: Record<string, React.ComponentType<NodeItemProps>> = {
  webpage: WebsiteNode,
  image: ImageNode,
  video: VideoNode,
  email: EmailNode,
  sms: SMSNode,
  ad: FacebookNode,
  google_search_ad: GoogleAdNode,
  google_banner_ad: GoogleAdNode,
  pdf: PdfNode,
  meta_lead_form: MetaLeadFormNode,
};

/* ─── Dispatcher ───────────────────────────────────────────────── */

function ReviewItemNodeComponent({ data, selected }: NodeProps) {
  const { item, readOnly, commentStats, onNavigate, onUpdateStatus } = data as ReviewItemNodeData;

  const commentCount = commentStats?.total ?? 0;
  const unresolvedCount = commentStats?.unresolved ?? 0;

  // Pick the right component (falls back to WebsiteNode for unknown types)
  const Component = NODE_COMPONENTS[item.type] || WebsiteNode;

  return (
    <Component
      item={item}
      selected={!!selected}
      readOnly={readOnly}
      commentCount={commentCount}
      unresolvedCount={unresolvedCount}
      commentsLoading={false}
      onNavigate={onNavigate}
      onUpdateStatus={onUpdateStatus}
    />
  );
}

const FeedbackItemNode = memo(ReviewItemNodeComponent);
FeedbackItemNode.displayName = 'FeedbackItemNode';

export default FeedbackItemNode;
