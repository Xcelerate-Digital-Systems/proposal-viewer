// components/admin/settings/settings-config.ts

import {
  Eye, CheckCircle2, MessageSquare, CheckCheck,
  Send, XCircle, PenLine, AlertCircle, Package, PartyPopper,
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
    label: 'Proposal Decisions',
    description: 'When a client accepts, declines, or requests revisions on a proposal',
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
];

/* ─── Pitch webhook events (proposals + quotes) ────────────────── */

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    key: 'proposal_sent',
    label: 'Sent',
    description: 'When a proposal or quote is marked as sent',
    icon: Send,
  },
  {
    key: 'proposal_viewed',
    label: 'Viewed',
    description: 'When a client opens a proposal or quote for the first time',
    icon: Eye,
  },
  {
    key: 'proposal_accepted',
    label: 'Accepted',
    description: 'When a client accepts a proposal or quote',
    icon: CheckCircle2,
  },
  {
    key: 'proposal_declined',
    label: 'Declined',
    description: 'When a client declines a proposal or quote',
    icon: XCircle,
  },
  {
    key: 'proposal_revision_requested',
    label: 'Changes Requested',
    description: 'When a client requests revisions',
    icon: PenLine,
  },
];

/* ─── Markup webhook events ──────────────────────────────────── */

export const REVIEW_WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    key: 'review_comment_added',
    label: 'Comment Added',
    description: 'When a client or reviewer comments on an asset',
    icon: MessageSquare,
  },
  {
    key: 'review_comment_resolved',
    label: 'Comment Resolved',
    description: 'When an asset comment is marked as resolved',
    icon: CheckCheck,
  },
  {
    key: 'review_item_approved',
    label: 'Asset Approved',
    description: 'When an asset is approved by the reviewer',
    icon: CheckCircle2,
  },
  {
    key: 'review_item_revision_needed',
    label: 'Asset Revision Needed',
    description: 'When an asset is flagged as needing changes',
    icon: AlertCircle,
  },
  {
    key: 'review_item_new_version',
    label: 'New Version Uploaded',
    description: 'When a new version of an asset is uploaded',
    icon: Package,
  },
  {
    key: 'review_feedback_marked_complete',
    label: 'Markup Completed',
    description: 'When a reviewer finishes and submits their markup',
    icon: PartyPopper,
  },
];
