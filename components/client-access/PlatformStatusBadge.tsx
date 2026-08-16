'use client';

import { Check, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { AccessGrantStatus } from '@/lib/client-access/types';

const STATUS_CONFIG: Record<AccessGrantStatus, { label: string; color: string; bg: string; icon: typeof Check }> = {
  pending: { label: 'Not Connected', color: '#6b7280', bg: '#6b728015', icon: Clock },
  oauth_complete: { label: 'Processing', color: '#f59e0b', bg: '#f59e0b15', icon: Loader2 },
  request_sent: { label: 'Pending Approval', color: '#f59e0b', bg: '#f59e0b15', icon: Clock },
  granted: { label: 'Connected', color: '#10b981', bg: '#10b98115', icon: Check },
  failed: { label: 'Failed', color: '#ef4444', bg: '#ef444415', icon: AlertCircle },
  self_reported: { label: 'Connected', color: '#10b981', bg: '#10b98115', icon: Check },
};

interface PlatformStatusBadgeProps {
  status: AccessGrantStatus;
}

export default function PlatformStatusBadge({ status }: PlatformStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      <Icon size={12} className={status === 'oauth_complete' ? 'animate-spin' : ''} />
      {config.label}
    </span>
  );
}
