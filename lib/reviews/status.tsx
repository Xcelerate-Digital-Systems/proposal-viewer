import {
  CheckCircle2, AlertCircle, Clock, Eye, UserCheck, Users, Sparkles, Archive,
} from 'lucide-react';
import type { ReviewStatus } from '@/lib/types/review';

export type ReviewStatusDef = {
  value: ReviewStatus;
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

export const REVIEW_STATUS_ORDER: ReviewStatus[] = [
  'draft',
  'internal_review',
  'external_review',
  'client_review',
  'revisions_completed',
  'approved',
  'archived',
];

export const REVIEW_STATUS_CONFIG: Record<ReviewStatus, ReviewStatusDef> = {
  draft: {
    value: 'draft', label: 'Draft', hex: '#9ca3af',
    dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200',
    symbol: '', icon: <Clock size={13} />,
  },
  internal_review: {
    value: 'internal_review', label: 'Internal Review', hex: '#3b82f6',
    dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200',
    symbol: '◉', icon: <Eye size={13} />,
  },
  external_review: {
    value: 'external_review', label: 'External Review', hex: '#8b5cf6',
    dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200',
    symbol: '◐', icon: <UserCheck size={13} />,
  },
  client_review: {
    value: 'client_review', label: 'Client Review', hex: '#f59e0b',
    dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
    symbol: '!', icon: <Users size={13} />,
  },
  revisions_completed: {
    value: 'revisions_completed', label: 'Revisions Completed', hex: '#0ea5e9',
    dot: 'bg-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200',
    symbol: '↻', icon: <Sparkles size={13} />,
  },
  approved: {
    value: 'approved', label: 'Approved', hex: '#10b981',
    dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',
    symbol: '✓', icon: <CheckCircle2 size={13} />,
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

export function getReviewStatusDef(status: ReviewStatus | string | null | undefined): ReviewStatusDef {
  if (status && (status as ReviewStatus) in REVIEW_STATUS_CONFIG) {
    return REVIEW_STATUS_CONFIG[status as ReviewStatus];
  }
  return REVIEW_STATUS_CONFIG.draft;
}
