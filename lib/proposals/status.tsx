// lib/proposals/status.tsx
//
// Status vocabulary shared by /proposals and /quotes (both live in the
// `proposals` table — quotes are just rows where entity_type='quote').
//
// Includes the canonical badge styling so every consumer (list cards,
// list rows, detail header, kanban board) uses identical colors.

import { FileText, Clock, Eye, PenLine, CheckCircle2, X } from 'lucide-react';
import type { StatusOption } from '@/components/ui/StatusDropdown';

export type ProposalStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'revision_requested'
  | 'accepted'
  | 'declined';

export interface ProposalStatusDef {
  value: ProposalStatus;
  label: string;
  /** Solid hex used on the kanban column dot. */
  hex: string;
  badge: {
    bg: string;
    text: string;
    border: string;
  };
}

export const PROPOSAL_STATUS_ORDER: ProposalStatus[] = [
  'draft',
  'sent',
  'viewed',
  'revision_requested',
  'accepted',
  'declined',
];

export const PROPOSAL_STATUS_CONFIG: Record<ProposalStatus, ProposalStatusDef> = {
  draft:              { value: 'draft',              label: 'Draft',              hex: '#9ca3af', badge: { bg: 'bg-surface',    text: 'text-dim',         border: 'border-edge' } },
  sent:               { value: 'sent',               label: 'Sent',               hex: '#3b82f6', badge: { bg: 'bg-teal-tint',  text: 'text-teal',        border: 'border-teal/20' } },
  viewed:             { value: 'viewed',             label: 'Viewed',             hex: '#f59e0b', badge: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' } },
  revision_requested: { value: 'revision_requested', label: 'Changes Requested', hex: '#ea580c', badge: { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' } },
  accepted:           { value: 'accepted',           label: 'Accepted',           hex: '#10b981', badge: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' } },
  declined:           { value: 'declined',           label: 'Declined',           hex: '#ef4444', badge: { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200' } },
};

const STATUS_ICONS: Record<ProposalStatus, React.ComponentType<{ size?: number }>> = {
  draft: FileText,
  sent: Clock,
  viewed: Eye,
  revision_requested: PenLine,
  accepted: CheckCircle2,
  declined: X,
};

export function getProposalStatusIcon(status: ProposalStatus, size = 12) {
  const Icon = STATUS_ICONS[status];
  return <Icon size={size} />;
}

export const PROPOSAL_STATUS_OPTIONS: StatusOption<ProposalStatus>[] =
  PROPOSAL_STATUS_ORDER.map((status) => {
    const def = PROPOSAL_STATUS_CONFIG[status];
    return {
      value: status,
      label: def.label,
      bg: def.badge.bg,
      text: def.badge.text,
      border: def.badge.border,
      icon: getProposalStatusIcon(status),
    };
  });

/**
 * Build the patch sent to the `proposals` table when a kanban card is
 * dragged into a new column. We also stamp the matching outcome timestamp
 * so admins moving cards manually don't see "Sent: never" type weirdness
 * in subsequent views.
 */
export function buildStatusPatch(next: ProposalStatus): Record<string, string | null> {
  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    status: next,
    updated_at: now,
  };
  if (next === 'sent') patch.sent_at = now;
  if (next === 'viewed') patch.first_viewed_at = now;
  if (next === 'accepted') patch.accepted_at = now;
  if (next === 'declined') patch.declined_at = now;
  return patch;
}
