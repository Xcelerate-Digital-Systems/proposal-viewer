import {
  CheckCircle2, Clock, Eye, Users, RefreshCw, Archive, Loader2, XCircle,
} from 'lucide-react';
import type { FeedbackStatus } from '@/lib/types/feedback';

export type ReviewStatusDef = {
  value: FeedbackStatus;
  label: string;
  /** Solid hex (used in SVG / non-Tailwind contexts). */
  hex: string;
  /** Tailwind class for solid fills (dots, progress segments). */
  dot: string;
  /** Tailwind background tint for pills. */
  bg: string;
  /** Tailwind text color for pills. */
  text: string;
  /** Tailwind border color for pills. */
  border: string;
  /** Single character symbol used on tiny status dots. */
  symbol: string;
  icon: React.ReactNode;
};

export const REVIEW_STATUS_ORDER: FeedbackStatus[] = [
  'draft',
  'in_progress',
  'internal_review',
  'client_review',
  'revision_needed',
  'approved',
  'rejected',
  'archived',
];

export const REVIEW_STATUS_CONFIG: Record<FeedbackStatus, ReviewStatusDef> = {
  draft: {
    value: 'draft', label: 'Draft', hex: '#9ca3af',
    dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200',
    symbol: '', icon: <Clock size={13} />,
  },
  in_progress: {
    value: 'in_progress', label: 'In Progress', hex: '#14b8a6',
    dot: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200',
    symbol: '◴', icon: <Loader2 size={13} />,
  },
  internal_review: {
    value: 'internal_review', label: 'Internal Review', hex: '#3b82f6',
    dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200',
    symbol: '◉', icon: <Eye size={13} />,
  },
  client_review: {
    value: 'client_review', label: 'Client Review', hex: '#f59e0b',
    dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
    symbol: '!', icon: <Users size={13} />,
  },
  revision_needed: {
    value: 'revision_needed', label: 'Revision Needed', hex: '#f97316',
    dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200',
    symbol: '↻', icon: <RefreshCw size={13} />,
  },
  approved: {
    value: 'approved', label: 'Approved', hex: '#10b981',
    dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',
    symbol: '✓', icon: <CheckCircle2 size={13} />,
  },
  rejected: {
    value: 'rejected', label: 'Rejected', hex: '#ef4444',
    dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200',
    symbol: '✕', icon: <XCircle size={13} />,
  },
  archived: {
    value: 'archived', label: 'Archived', hex: '#6b7280',
    dot: 'bg-gray-500', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200',
    symbol: '·', icon: <Archive size={13} />,
  },
};

export const REVIEW_STATUS_OPTIONS: ReviewStatusDef[] = REVIEW_STATUS_ORDER.map(
  (s) => REVIEW_STATUS_CONFIG[s],
);

export function getFeedbackStatusDef(status: FeedbackStatus | string | null | undefined): ReviewStatusDef {
  if (status && (status as FeedbackStatus) in REVIEW_STATUS_CONFIG) {
    return REVIEW_STATUS_CONFIG[status as FeedbackStatus];
  }
  // Legacy values that may still appear in log messages / webhook payloads
  // but are no longer valid — fall back to the closest current label.
  if (status === 'external_review') return REVIEW_STATUS_CONFIG.client_review;
  if (status === 'revisions_completed') return REVIEW_STATUS_CONFIG.approved;
  return REVIEW_STATUS_CONFIG.draft;
}
