// app/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText, MessageSquareText, MessageCircle, CheckCircle2, Clock,
  ChevronRight, Image, AlertCircle, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';

export default function DashboardPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <DashboardContent companyId={auth.companyId!} isSuperAdmin={auth.isSuperAdmin} />
      )}
    </AdminLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats card                                                         */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  accentColor?: string;
}

function StatCard({ label, value, icon: Icon, subtitle, accentColor = '#017C87' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accentColor}12` }}
      >
        <Icon size={20} style={{ color: accentColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section card (entry point to Proposals / Creative Review)          */
/* ------------------------------------------------------------------ */

interface SectionCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  stats: { label: string; value: string | number; color?: string }[];
  loading?: boolean;
}

function SectionCard({ href, icon: Icon, title, description, stats, loading }: SectionCardProps) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-[#017C87]/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#017C87]/10 flex items-center justify-center">
            <Icon size={20} className="text-[#017C87]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 font-[family-name:var(--font-display)]">
              {title}
            </h3>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        </div>
        <ChevronRight
          size={18}
          className="text-gray-300 group-hover:text-[#017C87] transition-colors mt-1"
        />
      </div>

      {loading ? (
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-5 w-8 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-6">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className={`text-lg font-bold ${stat.color || 'text-gray-900'}`}>
                {stat.value}
              </p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard content                                                  */
/* ------------------------------------------------------------------ */

function DashboardContent({ companyId, isSuperAdmin }: { companyId: string; isSuperAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [proposalStats, setProposalStats] = useState({
    total: 0,
    accepted: 0,
    comments: 0,
    unresolvedComments: 0,
  });
  const [reviewStats, setReviewStats] = useState({
    projects: 0,
    items: 0,
    comments: 0,
    unresolvedComments: 0,
  });

  const fetchStats = useCallback(async () => {
    if (!companyId) return;

    try {
      // ── Proposal stats ──
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id, accepted_at')
        .eq('company_id', companyId);

      const { data: propComments } = await supabase
        .from('proposal_comments')
        .select('id, resolved_at')
        .eq('company_id', companyId)
        .is('parent_id', null);

      setProposalStats({
        total: proposals?.length || 0,
        accepted: proposals?.filter((p) => p.accepted_at).length || 0,
        comments: propComments?.length || 0,
        unresolvedComments: propComments?.filter((c) => !c.resolved_at).length || 0,
      });

      // ── Review stats (super admin only) ──
      if (isSuperAdmin) {
        const { data: reviewProjects } = await supabase
          .from('review_projects')
          .select('id')
          .eq('company_id', companyId)
          .eq('status', 'active');

        const { data: reviewItems } = await supabase
          .from('review_items')
          .select('id')
          .eq('company_id', companyId);

        const { data: reviewComments } = await supabase
          .from('review_comments')
          .select('id, resolved')
          .eq('company_id', companyId)
          .is('parent_comment_id', null);

        setReviewStats({
          projects: reviewProjects?.length || 0,
          items: reviewItems?.length || 0,
          comments: reviewComments?.length || 0,
          unresolvedComments: reviewComments?.filter((c) => !c.resolved).length || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, isSuperAdmin]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-8 pb-4 border-b border-gray-200 lg:border-b-0">
        <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)]">
          Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Overview of your proposals{isSuperAdmin ? ' and creative review activity' : ''}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-4 lg:pt-0">
        {/* Section entry cards */}
        <div className={`grid grid-cols-1 ${isSuperAdmin ? 'lg:grid-cols-2' : ''} gap-4 mb-8`}>
          <SectionCard
            href="/proposals"
            icon={FileText}
            title="Proposals"
            description="Manage proposals, documents & templates"
            loading={loading}
            stats={[
              { label: 'Proposals', value: proposalStats.total },
              { label: 'Accepted', value: proposalStats.accepted, color: 'text-emerald-600' },
              {
                label: 'Open comments',
                value: proposalStats.unresolvedComments,
                color: proposalStats.unresolvedComments > 0 ? 'text-amber-600' : 'text-gray-900',
              },
            ]}
          />

          {isSuperAdmin && (
            <SectionCard
              href="/reviews"
              icon={MessageSquareText}
              title="Creative Review"
              description="Share assets & collect visual feedback"
              loading={loading}
              stats={[
                { label: 'Projects', value: reviewStats.projects },
                { label: 'Items', value: reviewStats.items },
                {
                  label: 'Open comments',
                  value: reviewStats.unresolvedComments,
                  color: reviewStats.unresolvedComments > 0 ? 'text-amber-600' : 'text-gray-900',
                },
              ]}
            />
          )}
        </div>

        {/* Quick stats */}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
          At a glance
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-[88px] animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-100" />
                  <div className="space-y-2 flex-1">
                    <div className="h-6 w-12 bg-gray-100 rounded" />
                    <div className="h-4 w-24 bg-gray-50 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-2 ${isSuperAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
            <StatCard
              label="Total Proposals"
              value={proposalStats.total}
              icon={FileText}
            />
            <StatCard
              label="Accepted"
              value={proposalStats.accepted}
              icon={CheckCircle2}
              accentColor="#059669"
            />
            {isSuperAdmin && (
              <StatCard
                label="Review Items"
                value={reviewStats.items}
                icon={Image}
              />
            )}
            <StatCard
              label="Open Threads"
              value={proposalStats.unresolvedComments + (isSuperAdmin ? reviewStats.unresolvedComments : 0)}
              icon={proposalStats.unresolvedComments + (isSuperAdmin ? reviewStats.unresolvedComments : 0) > 0 ? AlertCircle : MessageCircle}
              accentColor={proposalStats.unresolvedComments + (isSuperAdmin ? reviewStats.unresolvedComments : 0) > 0 ? '#F59E0B' : '#017C87'}
              subtitle={proposalStats.unresolvedComments + (isSuperAdmin ? reviewStats.unresolvedComments : 0) > 0 ? 'Needs attention' : 'All clear'}
            />
          </div>
        )}

        {/* Activity feed placeholder */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Recent Activity
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <Clock size={20} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">
              Proposal views, comments, and review activity will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}