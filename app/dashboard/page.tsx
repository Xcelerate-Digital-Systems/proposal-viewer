// app/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText, MessageCircle, CheckCircle2, Layers, TrendingUp, Timer,
  Search, Bell, Plus, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';

export default function DashboardPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <DashboardContent
          companyId={auth.companyId!}
          isSuperAdmin={auth.isSuperAdmin}
          memberName={auth.teamMember?.name}
          accountType={auth.accountType}
        />
      )}
    </AdminLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card — large number with icon badge                           */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  footer?: React.ReactNode;
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, footer }: StatCardProps) {
  return (
    <div className="bg-white rounded-[14px] border border-edge p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <span className="text-[13px] font-medium text-muted">{label}</span>
      </div>
      <p className="text-[32px] font-bold text-ink leading-none">{value}</p>
      {footer && <div>{footer}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent proposal row                                                */
/* ------------------------------------------------------------------ */

interface ProposalRowProps {
  name: string;
  meta: string;
  status: 'accepted' | 'viewed' | 'draft' | 'pending' | 'needs_review';
  isLast?: boolean;
}

const STATUS_CONFIG = {
  accepted:     { label: 'Accepted',     bg: '#E8F5E9', color: '#2E7D32', dot: '#2E7D32' },
  viewed:       { label: 'Viewed',       bg: '#E6F5F3', color: '#017C87', dot: '#017C87' },
  draft:        { label: 'Draft',        bg: '#F5F4F2', color: '#8A8A8A', dot: '#ABABAB' },
  pending:      { label: 'Pending',      bg: '#FFF8E1', color: '#E6A817', dot: '#E6A817' },
  needs_review: { label: 'Needs Review', bg: '#FFF8E1', color: '#E6A817', dot: '#E6A817' },
} as const;

function ProposalRow({ name, meta, status, isLast }: ProposalRowProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className={`flex items-center gap-3.5 px-6 py-3.5 ${!isLast ? 'border-b border-edge' : ''}`}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{name}</p>
        <p className="text-xs text-muted">{meta}</p>
      </div>
      <span
        className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity item                                                      */
/* ------------------------------------------------------------------ */

interface ActivityItemProps {
  initials: string;
  avatarBg: string;
  avatarColor: string;
  text: string;
  time: string;
  isLast?: boolean;
}

function ActivityItem({ initials, avatarBg, avatarColor, text, time, isLast }: ActivityItemProps) {
  return (
    <div className={`flex items-start gap-3 px-6 py-4 ${!isLast ? 'border-b border-edge' : ''}`}>
      <div
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: avatarBg }}
      >
        <span className="text-[10px] font-semibold" style={{ color: avatarColor }}>{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-ink leading-relaxed">{text}</p>
        <p className="text-[11px] text-faint mt-1">{time}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick action item (client view)                                    */
/* ------------------------------------------------------------------ */

interface QuickActionProps {
  number: string;
  numBg: string;
  numColor: string;
  text: string;
  time: string;
  isLast?: boolean;
}

function QuickAction({ number, numBg, numColor, text, time, isLast }: QuickActionProps) {
  return (
    <div className={`flex items-start gap-3 px-6 py-4 ${!isLast ? 'border-b border-edge' : ''}`}>
      <div
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: numBg }}
      >
        <span className="text-[10px] font-semibold" style={{ color: numColor }}>{number}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-ink leading-relaxed">{text}</p>
        <p className="text-[11px] text-faint mt-1">{time}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard content                                                  */
/* ------------------------------------------------------------------ */

interface DashboardContentProps {
  companyId: string;
  isSuperAdmin?: boolean;
  memberName?: string;
  accountType?: 'agency' | 'client';
}

function DashboardContent({ companyId, isSuperAdmin, memberName, accountType }: DashboardContentProps) {
  const [loading, setLoading] = useState(true);
  const [proposalStats, setProposalStats] = useState({
    total: 0, accepted: 0, comments: 0, unresolvedComments: 0,
  });
  const [reviewStats, setReviewStats] = useState({
    projects: 0, items: 0, comments: 0, unresolvedComments: 0,
  });
  const [recentProposals, setRecentProposals] = useState<
    { id: string; title: string; recipient_name?: string; accepted_at?: string; viewed_at?: string; created_at: string }[]
  >([]);

  const firstName = memberName?.split(' ')[0] || 'there';
  const isClient = accountType === 'client';

  const fetchStats = useCallback(async () => {
    if (!companyId) return;

    try {
      // Proposal stats
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id, title, recipient_name, accepted_at, viewed_at, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      const allProposals = proposals || [];
      setProposalStats({
        total: allProposals.length,
        accepted: allProposals.filter((p) => p.accepted_at).length,
        comments: 0,
        unresolvedComments: 0,
      });
      setRecentProposals(allProposals.slice(0, 4));

      // Comments
      const { data: propComments } = await supabase
        .from('proposal_comments')
        .select('id, resolved_at')
        .eq('company_id', companyId)
        .is('parent_id', null);

      setProposalStats((prev) => ({
        ...prev,
        comments: propComments?.length || 0,
        unresolvedComments: propComments?.filter((c) => !c.resolved_at).length || 0,
      }));

      // Review stats (super admin only)
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getProposalStatus = (p: typeof recentProposals[0]): ProposalRowProps['status'] => {
    if (p.accepted_at) return 'accepted';
    if (p.viewed_at) return 'viewed';
    return 'draft';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const totalThreads = proposalStats.unresolvedComments + (isSuperAdmin ? reviewStats.unresolvedComments : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-ivory px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted mt-1">
            {isClient
              ? `You have ${proposalStats.total - proposalStats.accepted} proposals waiting for your review.`
              : `Here\u2019s what\u2019s happening with your proposals today.`}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface rounded-[10px] px-3.5 py-2.5 w-[220px]">
            <Search size={16} className="text-faint" />
            <span className="text-[13px] text-faint">Search...</span>
          </div>
          <button className="w-[38px] h-[38px] rounded-[10px] border border-[#E8E8E8] bg-white flex items-center justify-center hover:bg-surface transition-colors">
            <Bell size={18} className="text-muted" />
          </button>
          {!isClient && (
            <Link
              href="/proposals"
              className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Plus size={16} />
              New Proposal
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        <div className="flex flex-col gap-8">
          {/* Stats row */}
          {loading ? (
            <div className={`grid grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-5`}>
              {Array.from({ length: isSuperAdmin ? 4 : 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[14px] border border-edge p-6 h-[120px] animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-surface" />
                    <div className="h-4 w-24 bg-surface rounded" />
                  </div>
                  <div className="h-8 w-12 bg-surface rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-5`}>
              <StatCard
                label={isClient ? 'Active Proposals' : 'Total Proposals'}
                value={proposalStats.total}
                icon={FileText}
                iconBg="#E6F5F3"
                iconColor="#017C87"
                footer={
                  isClient ? (
                    <div className="flex items-center gap-1">
                      <Timer size={14} className="text-teal" />
                      <span className="text-xs font-medium text-teal">
                        {proposalStats.total - proposalStats.accepted} awaiting your review
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <TrendingUp size={14} className="text-[#2E7D32]" />
                      <span className="text-xs font-medium text-[#2E7D32]">Active</span>
                    </div>
                  )
                }
              />
              <StatCard
                label={isClient ? 'Reviewed' : 'Accepted'}
                value={proposalStats.accepted}
                icon={CheckCircle2}
                iconBg="#E8F5E9"
                iconColor="#2E7D32"
                footer={
                  <span className="text-xs font-medium text-faint">
                    {proposalStats.total > 0
                      ? `${Math.round((proposalStats.accepted / proposalStats.total) * 100)}% acceptance rate`
                      : 'No proposals yet'}
                  </span>
                }
              />
              <StatCard
                label={isClient ? 'Pending Feedback' : 'Open Comments'}
                value={totalThreads}
                icon={MessageCircle}
                iconBg="#FFF8E1"
                iconColor="#E6A817"
                footer={
                  totalThreads > 0 ? (
                    <span className="text-xs font-medium text-[#E6A817]">
                      {isClient ? 'Action needed' : `${proposalStats.unresolvedComments} need response`}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-faint">All clear</span>
                  )
                }
              />
              {isSuperAdmin && (
                <StatCard
                  label="Review Items"
                  value={reviewStats.items}
                  icon={Layers}
                  iconBg="#E6F5F3"
                  iconColor="#017C87"
                  footer={
                    <span className="text-xs font-medium text-faint">
                      Across {reviewStats.projects} project{reviewStats.projects !== 1 ? 's' : ''}
                    </span>
                  }
                />
              )}
            </div>
          )}

          {/* Bottom row: Recent Proposals + Activity/Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 min-h-0">
            {/* Recent Proposals */}
            <div className="bg-white rounded-[14px] border border-edge flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
                <h2 className="text-[15px] font-semibold text-ink">
                  {isClient ? 'Your Proposals' : 'Recent Proposals'}
                </h2>
                <Link href="/proposals" className="text-[13px] font-medium text-teal hover:underline">
                  View all
                </Link>
              </div>
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-edge" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-48 bg-surface rounded" />
                        <div className="h-3 w-32 bg-surface rounded" />
                      </div>
                      <div className="h-5 w-16 bg-surface rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentProposals.length > 0 ? (
                <div className="flex-1">
                  {recentProposals.map((p, i) => (
                    <ProposalRow
                      key={p.id}
                      name={p.title || 'Untitled Proposal'}
                      meta={
                        isClient
                          ? `From your agency \u00b7 ${formatDate(p.created_at)}`
                          : p.recipient_name
                            ? `Sent to ${p.recipient_name} \u00b7 ${formatDate(p.created_at)}`
                            : `Created ${formatDate(p.created_at)}`
                      }
                      status={isClient
                        ? (p.accepted_at ? 'accepted' : 'needs_review')
                        : getProposalStatus(p)
                      }
                      isLast={i === recentProposals.length - 1}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                  <FileText size={24} className="text-faint mb-2" />
                  <p className="text-sm text-muted">No proposals yet</p>
                </div>
              )}
            </div>

            {/* Activity (agency) / Quick Actions (client) */}
            <div className="bg-white rounded-[14px] border border-edge flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-edge">
                <h2 className="text-[15px] font-semibold text-ink">
                  {isClient ? 'Quick Actions' : 'Activity'}
                </h2>
              </div>
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 animate-pulse">
                      <div className="w-[30px] h-[30px] rounded-full bg-surface shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-full bg-surface rounded" />
                        <div className="h-3 w-20 bg-surface rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isClient ? (
                <div className="flex-1">
                  {recentProposals.filter((p) => !p.accepted_at).length > 0 ? (
                    recentProposals
                      .filter((p) => !p.accepted_at)
                      .slice(0, 3)
                      .map((p, i, arr) => (
                        <QuickAction
                          key={p.id}
                          number={String(i + 1)}
                          numBg={i === 0 ? '#E6F5F3' : i === 1 ? '#FFF8E1' : '#E8F5E9'}
                          numColor={i === 0 ? '#017C87' : i === 1 ? '#E6A817' : '#2E7D32'}
                          text={`Review & respond to ${p.title || 'Untitled Proposal'}`}
                          time={`Sent ${formatDate(p.created_at)}`}
                          isLast={i === arr.length - 1}
                        />
                      ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 size={24} className="text-[#2E7D32] mb-2" />
                      <p className="text-sm text-muted">All caught up!</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1">
                  {recentProposals.length > 0 ? (
                    <>
                      {recentProposals.slice(0, 3).map((p, i, arr) => {
                        const colors = [
                          { bg: '#E8D5F5', color: '#7C3AED' },
                          { bg: '#D5E8F5', color: '#2563EB' },
                          { bg: '#F5E8D5', color: '#D97706' },
                        ];
                        const c = colors[i % colors.length];
                        const initials = p.recipient_name
                          ? p.recipient_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                          : '??';
                        const action = p.accepted_at
                          ? `${p.recipient_name || 'Client'} accepted ${p.title}`
                          : p.viewed_at
                            ? `${p.recipient_name || 'Client'} viewed ${p.title}`
                            : `${p.title} was created`;
                        return (
                          <ActivityItem
                            key={p.id}
                            initials={initials}
                            avatarBg={c.bg}
                            avatarColor={c.color}
                            text={action}
                            time={formatDate(p.created_at)}
                            isLast={i === Math.min(arr.length, 3) - 1}
                          />
                        );
                      })}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                      <MessageCircle size={24} className="text-faint mb-2" />
                      <p className="text-sm text-muted">Activity will appear here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
