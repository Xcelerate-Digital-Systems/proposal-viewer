'use client';

import { useState, useEffect } from 'react';
import { Eye, Clock, FileText, Monitor, Smartphone, Tablet, Loader2, Users } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';

interface ViewSummary {
  totalViews: number;
  uniqueViewers: number;
  avgTimeSeconds: number;
  avgPagesViewed: number;
}

interface ViewRecord {
  id: string;
  viewer_email: string | null;
  viewer_name: string | null;
  device_type: string | null;
  pages_viewed: number;
  total_time_seconds: number;
  page_times: Record<string, number> | null;
  max_scroll_depth: number;
  created_at: string;
  last_activity_at: string;
}

const DeviceIcon = ({ type }: { type: string | null }) => {
  if (type === 'mobile') return <Smartphone size={14} className="text-faint" />;
  if (type === 'tablet') return <Tablet size={14} className="text-faint" />;
  return <Monitor size={14} className="text-faint" />;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

interface Props {
  proposalId: string;
}

export default function ProposalAnalytics({ proposalId }: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ViewSummary | null>(null);
  const [views, setViews] = useState<ViewRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/proposals/${proposalId}/analytics`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setSummary(data.summary);
        setViews(data.views || []);
      } catch {
        // Silently handle — table may not exist yet
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

  if (!summary || summary.totalViews === 0) {
    return (
      <div className="px-6 lg:px-10 py-8">
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

  return (
    <div className="px-6 lg:px-10 py-8 space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Eye}
          label="Total Views"
          value={String(summary.totalViews)}
        />
        <StatCard
          icon={Users}
          label="Unique Viewers"
          value={String(summary.uniqueViewers)}
        />
        <StatCard
          icon={Clock}
          label="Avg. Time Spent"
          value={formatDuration(summary.avgTimeSeconds)}
        />
        <StatCard
          icon={FileText}
          label="Avg. Pages Viewed"
          value={String(summary.avgPagesViewed)}
        />
      </div>

      {/* View history */}
      <div>
        <h3 className="text-sm font-semibold text-prose mb-3">View History</h3>
        <div className="bg-white rounded-2xl border border-edge overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_80px_80px] gap-2 px-4 py-2.5 border-b border-edge text-2xs font-semibold uppercase tracking-wider text-faint">
            <div>Viewer</div>
            <div className="text-right">Time Spent</div>
            <div className="text-right">Pages</div>
            <div className="text-center">Device</div>
            <div className="text-right">When</div>
          </div>
          {views.map((view) => (
            <div
              key={view.id}
              className="grid grid-cols-[1fr_100px_100px_80px_80px] gap-2 px-4 py-3 border-b border-edge last:border-b-0 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">
                  {view.viewer_name || view.viewer_email || 'Anonymous'}
                </div>
                {view.viewer_name && view.viewer_email && (
                  <div className="text-2xs text-faint truncate">{view.viewer_email}</div>
                )}
              </div>
              <div className="text-right text-dim tabular-nums">
                {formatDuration(view.total_time_seconds || 0)}
              </div>
              <div className="text-right text-dim tabular-nums">
                {view.pages_viewed || 1}
              </div>
              <div className="flex items-center justify-center">
                <DeviceIcon type={view.device_type} />
              </div>
              <div className="text-right text-faint text-xs">
                {formatRelativeDate(view.created_at)}
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
