'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, DollarSign, Crown, Clock, MessageSquareText,
  TrendingUp, Loader2,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/ui/PageHeader';
import { supabase } from '@/lib/supabase';
import AccountsTab from '@/components/admin/platform/AccountsTab';
import SupportTab from '@/components/admin/platform/SupportTab';

type Tab = 'accounts' | 'support';

type Metrics = {
  totalAccounts: number;
  activeSubscriptions: number;
  trialingAccounts: number;
  lifetimeAccounts: number;
  mrrCents: number;
  openTickets: number;
  recentSignups: { id: string; name: string; created_at: string }[];
};

export default function AccountsPage() {
  return (
    <AdminLayout>
      {(auth) => {
        if (!auth.isSuperAdmin) {
          return (
            <div className="flex items-center justify-center h-screen">
              <p className="text-faint">Access denied</p>
            </div>
          );
        }
        return <AdminDashboard />;
      }}
    </AdminLayout>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setMetrics(await res.json());
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const formatMoney = (cents: number) => {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const stats: { label: string; value: string; sub?: string; icon: typeof Building2; color: string }[] = [
    {
      label: 'Accounts',
      value: metricsLoading ? '—' : String(metrics?.totalAccounts ?? 0),
      icon: Building2,
      color: 'text-teal bg-teal/10',
    },
    {
      label: 'Active Subs',
      value: metricsLoading ? '—' : String(metrics?.activeSubscriptions ?? 0),
      sub: metrics?.trialingAccounts ? `${metrics.trialingAccounts} trialing` : undefined,
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'MRR',
      value: metricsLoading ? '—' : formatMoney(metrics?.mrrCents ?? 0),
      icon: DollarSign,
      color: 'text-sky-600 bg-sky-50',
    },
    {
      label: 'Lifetime',
      value: metricsLoading ? '—' : String(metrics?.lifetimeAccounts ?? 0),
      icon: Crown,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Open Tickets',
      value: metricsLoading ? '—' : String(metrics?.openTickets ?? 0),
      icon: MessageSquareText,
      color: metrics?.openTickets ? 'text-red-600 bg-red-50' : 'text-faint bg-surface',
    },
  ];

  return (
    <div>
      <PageHeader title="Platform Admin" description="Manage accounts, subscriptions, and support" />

      <div className="px-6 lg:px-10 py-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white border border-edge rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-xs text-faint font-medium">{s.label}</span>
                </div>
                <div className="text-xl font-semibold text-ink">{s.value}</div>
                {s.sub && <div className="text-detail text-faint mt-0.5">{s.sub}</div>}
              </div>
            );
          })}
        </div>

        {/* Recent signups (compact) */}
        {metrics?.recentSignups && metrics.recentSignups.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-faint" />
              <span className="text-xs font-medium text-muted">Recent signups</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {metrics.recentSignups.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-edge rounded-lg text-xs text-ink"
                >
                  <Building2 size={11} className="text-faint" />
                  {s.name}
                  <span className="text-faint">
                    {new Date(s.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-edge mb-6">
          <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}>
            <Building2 size={14} />
            Accounts
          </TabButton>
          <TabButton active={tab === 'support'} onClick={() => setTab('support')}>
            <MessageSquareText size={14} />
            Support
            {metrics?.openTickets ? (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-detail font-semibold bg-red-100 text-red-700">
                {metrics.openTickets}
              </span>
            ) : null}
          </TabButton>
        </div>

        {/* Tab content */}
        {tab === 'accounts' && <AccountsTab onMetricsChange={fetchMetrics} />}
        {tab === 'support' && <SupportTab />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-teal text-teal'
          : 'border-transparent text-faint hover:text-muted hover:border-edge'
      }`}
    >
      {children}
    </button>
  );
}
