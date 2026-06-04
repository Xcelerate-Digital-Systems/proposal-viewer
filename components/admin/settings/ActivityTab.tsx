'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Send, CheckCircle2, Eye, MousePointerClick, AlertTriangle, Clock,
  Search, ChevronLeft, ChevronRight, ExternalLink, RefreshCw,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import Button from '@/components/ui/Button';

type EmailLogEntry = {
  id: string;
  to_email: string;
  from_email: string | null;
  subject: string | null;
  category: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  bounce_reason: string | null;
};

const STATUS_CONFIG: Record<string, { icon: typeof Send; label: string; bg: string; text: string }> = {
  sent:       { icon: Send,              label: 'Sent',      bg: 'bg-gray-100',    text: 'text-gray-600' },
  delivered:  { icon: CheckCircle2,      label: 'Delivered', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  opened:     { icon: Eye,               label: 'Opened',    bg: 'bg-blue-50',     text: 'text-blue-700' },
  clicked:    { icon: MousePointerClick, label: 'Clicked',   bg: 'bg-violet-50',   text: 'text-violet-700' },
  bounced:    { icon: AlertTriangle,     label: 'Bounced',   bg: 'bg-red-50',      text: 'text-red-700' },
  complained: { icon: AlertTriangle,     label: 'Spam',      bg: 'bg-red-50',      text: 'text-red-700' },
  delayed:    { icon: Clock,             label: 'Delayed',   bg: 'bg-amber-50',    text: 'text-amber-700' },
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'proposal_notification', label: 'Proposal' },
  { value: 'campaign_notification', label: 'Campaign' },
  { value: 'campaign_digest', label: 'Campaign digest' },
  { value: 'campaign_mention', label: 'Mention' },
  { value: 'campaign_invite', label: 'Invite' },
  { value: 'campaign_reminder', label: 'Reminder' },
  { value: 'campaign_task', label: 'Task' },
  { value: 'proposal_confirmation', label: 'Confirmation' },
  { value: 'billing', label: 'Billing' },
  { value: 'auth', label: 'Auth' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Spam' },
];

const PAGE_SIZE = 20;

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  return formatDateTime(dateStr);
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

function categoryLabel(category: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === category)?.label || category;
}

export default function ActivityTab({ companyId }: { companyId: string }) {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      company_id: companyId,
    });
    if (search) params.set('to', search);
    if (category) params.set('category', category);
    if (status) params.set('status', status);

    try {
      const res = await authFetch(`/api/admin/email-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.emails || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Silently fail — empty state is fine
    } finally {
      setLoading(false);
    }
  }, [page, search, category, status, companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = () => {
    setPage(0);
    setSearch(searchInput.trim());
  };

  const handleReset = () => {
    setPage(0);
    setSearch('');
    setSearchInput('');
    setCategory('');
    setStatus('');
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-2xs font-medium text-muted uppercase tracking-wide mb-1 block">
            Recipient
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by email..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-edge rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder-faint"
            />
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted uppercase tracking-wide mb-1 block">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm bg-white border border-edge rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-ink"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted uppercase tracking-wide mb-1 block">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            className="px-3 py-2 text-sm bg-white border border-edge rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-ink"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={handleSearch}>Search</Button>
          {(search || category || status) && (
            <Button variant="ghost" size="sm" onClick={handleReset}>Clear</Button>
          )}
          <Button variant="ghost" size="sm" onClick={fetchData} aria-label="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white border border-edge rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_180px_100px_100px_100px] gap-3 px-5 py-3 border-b border-edge bg-surface text-2xs font-semibold text-muted uppercase tracking-wide">
          <span>Recipient / Subject</span>
          <span>Category</span>
          <span>Status</span>
          <span>Sent</span>
          <span className="text-right">Actions</span>
        </div>

        {loading && entries.length === 0 ? (
          <div className="px-5 py-8 space-y-3 animate-pulse">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-edge rounded w-1/3" />
                  <div className="h-2.5 bg-edge rounded w-2/3" />
                </div>
                <div className="h-3 bg-edge rounded w-16" />
                <div className="h-3 bg-edge rounded w-16" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Send size={20} className="mx-auto text-faint mb-2" />
            <p className="text-sm font-medium text-ink">No emails found</p>
            <p className="text-xs text-muted mt-1">
              {search || category || status
                ? 'Try adjusting your filters.'
                : 'Emails will appear here as they are sent.'}
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.sent;
              const StatusIcon = cfg.icon;
              const href = entityHref(entry);
              const isExpanded = expanded === entry.id;

              return (
                <div key={entry.id} className="border-b border-edge last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                    className="w-full grid grid-cols-[1fr_180px_100px_100px_100px] gap-3 px-5 py-3.5 text-left hover:bg-surface/50 transition-colors items-center"
                  >
                    {/* Recipient + subject */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{entry.to_email}</p>
                      <p className="text-xs text-muted truncate mt-0.5">
                        {entry.subject || '(no subject)'}
                      </p>
                    </div>

                    {/* Category */}
                    <span className="text-xs text-muted">
                      {categoryLabel(entry.category)}
                    </span>

                    {/* Status */}
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
                      <StatusIcon size={12} />
                      {cfg.label}
                    </span>

                    {/* Sent time */}
                    <time dateTime={entry.sent_at} className="text-xs text-muted">
                      {formatRelative(entry.sent_at)}
                    </time>

                    {/* Actions */}
                    <div className="text-right">
                      {href && (
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
                        >
                          <ExternalLink size={11} />
                          Open
                        </Link>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-0 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-surface/30">
                      <DetailItem label="From" value={entry.from_email || '—'} />
                      <DetailItem label="Event type" value={entry.event_type || '—'} />
                      <DetailItem label="Entity" value={entry.entity_type ? `${entry.entity_type} ${entry.entity_id?.slice(0, 8) || ''}` : '—'} />
                      <DetailItem label="Sent" value={entry.sent_at ? formatDateTime(entry.sent_at) : '—'} />
                      <DetailItem
                        label="Delivered"
                        value={entry.delivered_at ? formatDateTime(entry.delivered_at) : 'Pending'}
                        highlight={!!entry.delivered_at}
                      />
                      <DetailItem
                        label="Opened"
                        value={entry.opened_at ? formatDateTime(entry.opened_at) : '—'}
                        highlight={!!entry.opened_at}
                      />
                      <DetailItem
                        label="Clicked"
                        value={entry.clicked_at ? formatDateTime(entry.clicked_at) : '—'}
                        highlight={!!entry.clicked_at}
                      />
                      {entry.bounce_reason && (
                        <DetailItem label="Bounce reason" value={entry.bounce_reason} isError />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {total} {total === 1 ? 'email' : 'emails'} · page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  highlight,
  isError,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  isError?: boolean;
}) {
  return (
    <div>
      <p className="text-2xs font-medium text-muted uppercase tracking-wide">{label}</p>
      <p className={`text-xs mt-0.5 truncate ${isError ? 'text-red-600' : highlight ? 'text-ink font-medium' : 'text-muted'}`}>
        {value}
      </p>
    </div>
  );
}
