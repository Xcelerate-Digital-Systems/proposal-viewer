'use client';

import { useState, useEffect } from 'react';
import { Eye, Clock, FileText, Monitor, Smartphone, Tablet, Loader2, Users, BarChart3, CalendarDays } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';

interface Summary {
  totalSessions: number;
  uniqueViewers: number;
  avgTimeSeconds: number;
  avgPagesViewed: number;
  totalTimeSeconds: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
}

interface PageBreakdown {
  pageIndex: number;
  pageName: string;
  pageType: string;
  totalSeconds: number;
  sessions: number;
}

interface Session {
  id: string;
  viewerName: string | null;
  viewerEmail: string | null;
  deviceType: string;
  pagesViewed: number;
  totalTimeSeconds: number;
  maxScrollDepth: number;
  pageTimes: Record<string, number>;
  startedAt: string;
  lastActivityAt: string;
}

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === 'mobile') return <Smartphone size={14} className="text-faint" />;
  if (type === 'tablet') return <Tablet size={14} className="text-faint" />;
  return <Monitor size={14} className="text-faint" />;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelative(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

interface Props {
  proposalId: string;
}

export default function ProposalAnalytics({ proposalId }: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pageBreakdown, setPageBreakdown] = useState<PageBreakdown[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/proposals/${proposalId}/analytics`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setSummary(data.summary);
        setPageBreakdown(data.pageBreakdown || []);
        setSessions(data.sessions || []);
      } catch {
        // Table may not exist yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [proposalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="text-faint animate-spin" />
      </div>
    );
  }

  if (!summary || summary.totalSessions === 0) {
    return (
      <div className="px-6 lg:px-10 py-6">
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Eye size={28} className="text-faint" />
          </div>
          <h3 className="text-lg font-semibold text-muted mb-1">No views yet</h3>
          <p className="text-sm text-faint max-w-sm mx-auto">
            Share this proposal with your client — view analytics will appear here once they open it.
          </p>
        </div>
      </div>
    );
  }

  const maxPageTime = Math.max(...pageBreakdown.map((p) => p.totalSeconds), 1);

  return (
    <div className="px-6 lg:px-10 py-6 space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Eye} label="Total Views" value={String(summary.totalSessions)} />
        <StatCard icon={Users} label="Unique Viewers" value={String(summary.uniqueViewers)} />
        <StatCard icon={Clock} label="Avg. Time Spent" value={formatDuration(summary.avgTimeSeconds)} />
        <StatCard icon={FileText} label="Avg. Pages Viewed" value={String(summary.avgPagesViewed)} />
      </div>

      {/* Timeline bar */}
      {summary.firstViewedAt && (
        <div className="flex items-center gap-3 text-xs text-dim bg-white rounded-2xl border border-edge px-4 py-3">
          <CalendarDays size={14} className="text-faint shrink-0" />
          <span>First viewed <strong className="text-ink">{formatDate(summary.firstViewedAt)}</strong></span>
          <span className="text-edge-hover">·</span>
          <span>Last viewed <strong className="text-ink">{formatRelative(summary.lastViewedAt!)}</strong></span>
          <span className="text-edge-hover">·</span>
          <span>Total time <strong className="text-ink">{formatDuration(summary.totalTimeSeconds)}</strong></span>
        </div>
      )}

      {/* Page engagement breakdown */}
      {pageBreakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-prose mb-3 flex items-center gap-2">
            <BarChart3 size={14} className="text-faint" />
            Page Engagement
          </h3>
          <div className="bg-white rounded-2xl border border-edge overflow-hidden">
            {pageBreakdown.map((page, i) => {
              const barWidth = Math.max(4, (page.totalSeconds / maxPageTime) * 100);
              return (
                <div
                  key={page.pageIndex}
                  className={`flex items-center gap-3 px-4 py-3 ${i < pageBreakdown.length - 1 ? 'border-b border-edge' : ''}`}
                >
                  <div className="w-6 text-center">
                    <span className="text-2xs font-medium text-faint">{page.pageIndex + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink truncate pr-3">{page.pageName}</span>
                      <span className="text-xs text-dim tabular-nums shrink-0">{formatDuration(page.totalSeconds)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session history */}
      <div>
        <h3 className="text-sm font-semibold text-prose mb-3">View Sessions</h3>
        <div className="bg-white rounded-2xl border border-edge overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_80px_60px_100px] gap-2 px-4 py-2.5 border-b border-edge text-2xs font-semibold uppercase tracking-wider text-faint">
            <div>Viewer</div>
            <div className="text-right">Time Spent</div>
            <div className="text-right">Pages</div>
            <div className="text-center">Device</div>
            <div className="text-right">When</div>
          </div>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[1fr_100px_80px_60px_100px] gap-2 px-4 py-3 border-b border-edge last:border-b-0 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">
                  {s.viewerName || 'Viewer'}
                </div>
                {s.viewerEmail && (
                  <div className="text-2xs text-faint truncate">{s.viewerEmail}</div>
                )}
              </div>
              <div className="text-right text-dim tabular-nums">
                {formatDuration(s.totalTimeSeconds)}
              </div>
              <div className="text-right text-dim tabular-nums">
                {s.pagesViewed}
              </div>
              <div className="flex items-center justify-center">
                <DeviceIcon type={s.deviceType} />
              </div>
              <div className="text-right text-faint text-xs">
                {formatDateTime(s.startedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-edge p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-teal-tint flex items-center justify-center">
          <Icon size={16} className="text-teal" />
        </div>
      </div>
      <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="text-xs text-faint mt-0.5">{label}</div>
    </div>
  );
}
