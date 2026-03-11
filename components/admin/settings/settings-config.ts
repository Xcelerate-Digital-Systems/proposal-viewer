// components/admin/settings/settings-config.ts

import {
  Eye, CheckCircle2, MessageSquare, CheckCheck,
  Send, XCircle, PenLine, AlertCircle,
  type LucideIcon,
} from 'lucide-react';

/* ─── Shared types ───────────────────────────────────────────── */

export interface NotificationOption {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface WebhookEvent {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/* ─── Proposal notification options ──────────────────────────── */

export const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'notify_proposal_viewed',
    label: 'Proposal Viewed',
    description: 'When a client opens a proposal for the first time',
    icon: Eye,
  },
  {
    key: 'notify_proposal_accepted',
    label: 'Proposal Accepted',
    description: 'When a client accepts a proposal',
    icon: CheckCircle2,
  },
  {
    key: 'notify_comment_added',
    label: 'New Comment',
    description: 'When someone adds a comment on a proposal',
    icon: MessageSquare,
  },
  {
    key: 'notify_comment_resolved',
    label: 'Comment Resolved',
    description: 'When a comment is marked as resolved',
    icon: CheckCheck,
  },
  {
    key: 'notify_proposal_accepted',
    label: 'Proposal Declined',
    description: 'When a client declines a proposal',
    icon: XCircle,
  },
  {
    key: 'notify_proposal_accepted',
    label: 'Changes Requested',
    description: 'When a client requests revisions on a proposal',
    icon: PenLine,
  },
];

/* ─── Review notification options ────────────────────────────── */

export const REVIEW_NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'notify_review_comment_added',
    label: 'Review Comment Added',
    description: 'When a client or team member comments on a review item',
    icon: MessageSquare,
  },
  {
    key: 'notify_review_item_status',
    label: 'Review Item Status Changed',
    description: 'When a review item is approved or needs revision',
    icon: AlertCircle,
  },
];

/* ─── Proposal webhook events ────────────────────────────────── */

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    key: 'proposal_sent',
    label: 'Proposal Sent',
    description: 'Fires when a proposal is marked as sent to a client',
    icon: Send,
  },
  {
    key: 'proposal_viewed',
    label: 'Proposal Viewed',
    description: 'Fires when a client opens a proposal for the first time',
    icon: Eye,
  },
  {
    key: 'proposal_accepted',
    label: 'Proposal Accepted',
    description: 'Fires when a client accepts a proposal',
    icon: CheckCircle2,
  },
  {
    key: 'proposal_declined',
    label: 'Proposal Declined',
    description: 'Fires when a client declines a proposal',
    icon: XCircle,
  },
  {
    key: 'proposal_revision_requested',
    label: 'Changes Requested',
    description: 'Fires when a client requests revisions on a proposal',
    icon: PenLine,
  },
  {
    key: 'comment_added',
    label: 'Comment Added',
    description: 'Fires when someone adds a comment on a proposal',
    icon: MessageSquare,
  },
  {
    key: 'comment_resolved',
    label: 'Comment Resolved',
    description: 'Fires when a comment is marked as resolved',
    icon: CheckCheck,
  },
];

/* ─── Review webhook events ──────────────────────────────────── */

export const REVIEW_WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    key: 'review_comment_added',
    label: 'Review Comment Added',
    description: 'Fires when someone comments on a review item',
    icon: MessageSquare,
  },
  {
    key: 'review_comment_resolved',
    label: 'Review Comment Resolved',
    description: 'Fires when a review comment is resolved',
    icon: CheckCheck,
  },
  {
    key: 'review_item_approved',
    label: 'Review Item Approved',
    description: 'Fires when a review item is marked as approved',
    icon: CheckCircle2,
  },
  {
    key: 'review_item_revision_needed',
    label: 'Review Revision Needed',
    description: 'Fires when a review item is marked as needing revision',
    icon: AlertCircle,
  },
];
