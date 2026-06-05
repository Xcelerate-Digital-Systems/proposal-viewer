'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, CheckCircle2, Eye, MousePointerClick, AlertTriangle, Clock, Send } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';

type EmailLogEntry = {
  id: string;
  to_email: string;
  subject: string | null;
  category: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  sent_at: string;
};

const STATUS_CONFIG: Record<string, { icon: typeof Send; label: string; className: string }> = {
  sent:       { icon: Send,              label: 'Sent',      className: 'text-muted' },
  delivered:  { icon: CheckCircle2,      label: 'Delivered', className: 'text-emerald-600' },
  opened:     { icon: Eye,               label: 'Opened',    className: 'text-blue-600' },
  clicked:    { icon: MousePointerClick, label: 'Clicked',   className: 'text-violet-600' },
  bounced:    { icon: AlertTriangle,     label: 'Bounced',   className: 'text-red-500' },
  complained: { icon: AlertTriangle,     label: 'Spam',      className: 'text-red-500' },
  delayed:    { icon: Clock,             label: 'Delayed',   className: 'text-amber-500' },
};

const CATEGORY_LABELS: Record<string, string> = {
  proposal_notification: 'Proposal',
  campaign_notification: 'Campaign',
  campaign_digest:       'Campaign digest',
  campaign_mention:      'Mention',
  campaign_invite:       'Invite',
  campaign_reminder:     'Reminder',
  campaign_task:         'Task',
  proposal_confirmation: 'Confirmation',
  billing:               'Billing',
  auth:                  'Auth',
};

function formatRelative(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

function entityHref(entry: EmailLogEntry): string | null {
  if (!entry.entity_id) return null;
  if (entry.entity_type === 'proposal' || entry.entity_type === 'quote') {
    return `/proposals/${entry.entity_id}`;
  }
  if (entry.entity_type === 'campaign') {
    return `/campaigns/${entry.entity_id}/board`;
  }
  return null;
}

const COLLAPSED_COUNT = 3;

export default function EmailActivityWidget({ companyId }: { companyId: string }) {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    authFetch(`/api/admin/email-log?limit=8&company_id=${companyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.emails) setEntries(data.emails);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center">
            <Mail size={14} className="text-muted" />
          </div>
          <h2 className="text-sm font-semibold text-ink">Agency Activity</h2>
          {entries.length > 0 && (
            <span className="text-detail text-muted">{entries.length}</span>
          )}
        </div>
        <Link
          href="/settings?tab=activity"
          className="text-xs font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="px-5 pb-4 space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-edge shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-edge rounded w-3/4" />
                <div className="h-2 bg-edge rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="px-5 pb-5 text-center">
          <p className="text-caption text-muted">No emails sent yet.</p>
        </div>
      ) : (
        <div className="px-5 pb-3">
          {(expanded ? entries : entries.slice(0, COLLAPSED_COUNT)).map((entry, i, arr) => {
            const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.sent;
            const StatusIcon = cfg.icon;
            const href = entityHref(entry);
            const categoryLabel = CATEGORY_LABELS[entry.category] || entry.category;

            return (
              <div
                key={entry.id}
                className={`flex items-start gap-3 py-2.5 ${
                  i < arr.length - 1 ? 'border-b border-edge' : ''
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    entry.status === 'bounced' || entry.status === 'complained'
                      ? 'bg-red-50'
                      : entry.status === 'opened' || entry.status === 'clicked'
                      ? 'bg-blue-50'
                      : entry.status === 'delivered'
                      ? 'bg-emerald-50'
                      : 'bg-surface'
                  }`}
                  title={cfg.label}
                >
                  <StatusIcon size={12} className={cfg.className} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-medium text-ink truncate">
                      {entry.to_email}
                    </span>
                    <time
                      dateTime={entry.sent_at}
                      className="text-detail text-faint ml-auto shrink-0"
                    >
                      {formatRelative(entry.sent_at)}
                    </time>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-detail text-muted truncate">
                      {entry.subject || categoryLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-2xs font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                    <span className="text-2xs text-faint">·</span>
                    <span className="text-2xs text-faint">{categoryLabel}</span>
                    {href && (
                      <>
                        <span className="text-2xs text-faint">·</span>
                        <Link
                          href={href}
                          className="text-2xs font-medium text-primary hover:text-primary-hover"
                        >
                          Open
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {entries.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-center py-2.5 border-t border-edge text-xs font-medium text-primary hover:text-primary-hover transition-colors"
            >
              {expanded ? 'Show less' : `Show ${entries.length - COLLAPSED_COUNT} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
