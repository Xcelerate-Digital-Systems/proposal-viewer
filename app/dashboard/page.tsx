// app/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText, CheckCircle2, Layers, Timer,
  Search, Bell, ReceiptText, Files, Workflow, Plug, ArrowUpRight,
  Eye, Send, Reply, Sparkles, AlertCircle, type LucideIcon,
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString();
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trim()}…` : s;
}

/* ------------------------------------------------------------------ */
/*  Stat card (client view only)                                       */
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
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
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
/*  Summary pill — top-of-dashboard counts                             */
/* ------------------------------------------------------------------ */

interface SummaryPillProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'urgent' | 'warm' | 'neutral' | 'positive';
}

const TONE_COLORS: Record<SummaryPillProps['tone'], { bg: string; color: string; iconBg: string }> = {
  urgent:   { bg: '#FFF8E1', color: '#92500F', iconBg: '#FFE6B0' },
  warm:     { bg: '#E6F5F3', color: '#017C87', iconBg: '#C7ECE7' },
  neutral:  { bg: '#F5F4F2', color: '#6B6B6B', iconBg: '#E6E5E2' },
  positive: { bg: '#E8F5E9', color: '#2E7D32', iconBg: '#CFE9D1' },
};

function SummaryPill({ label, value, icon: Icon, tone }: SummaryPillProps) {
  const c = TONE_COLORS[tone];
  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: c.iconBg }}>
        <Icon size={18} style={{ color: c.color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[24px] font-bold leading-none" style={{ color: c.color }}>{value}</p>
        <p className="text-[12px] text-muted mt-1.5">{label}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inbox card + row                                                   */
/* ------------------------------------------------------------------ */

interface InboxCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  iconColor: string;
  emptyLabel: string;
  viewAllHref?: string;
  children?: React.ReactNode;
}

function InboxCard({ title, count, icon: Icon, iconColor, emptyLabel, viewAllHref, children }: InboxCardProps) {
  const hasItems = count > 0;
  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Icon size={16} style={{ color: iconColor }} />
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          {hasItems && (
            <span className="text-[11px] font-semibold text-muted bg-surface rounded-full px-2 py-0.5">
              {count}
            </span>
          )}
        </div>
        {viewAllHref && hasItems && (
          <Link href={viewAllHref} className="text-[12px] font-medium text-teal hover:underline">
            View all
          </Link>
        )}
      </div>
      {hasItems ? (
        <div className="flex-1">{children}</div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <CheckCircle2 size={20} className="text-[#2E7D32]/60 mb-2" />
          <p className="text-[13px] text-muted">{emptyLabel}</p>
        </div>
      )}
    </div>
  );
}

interface InboxRowProps {
  href: string;
  title: string;
  subtitle: string;
  meta: string;
  badge?: { label: string; bg: string; color: string };
  isLast?: boolean;
}

function InboxRow({ href, title, subtitle, meta, badge, isLast }: InboxRowProps) {
  return (
    <Link
      href={href}
      className={`block px-5 py-3 hover:bg-surface/60 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-ink truncate">{title}</p>
            {badge && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted mt-0.5 truncate">{subtitle}</p>
        </div>
        <span className="text-[11px] text-faint shrink-0">{meta}</span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Tool tile (compact nav strip at bottom)                            */
/* ------------------------------------------------------------------ */

interface ToolTileProps {
  href: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  count: number;
}

function ToolTile({ href, label, icon: Icon, iconBg, iconColor, count }: ToolTileProps) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-xl shadow-[0_1px_2px_rgba(20,20,40,0.04)] hover:shadow-[0_2px_8px_rgba(20,20,40,0.08)] transition-shadow px-4 py-3 flex items-center gap-3"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink truncate">{label}</p>
        <p className="text-[11px] text-muted">{count.toLocaleString()}</p>
      </div>
      <ArrowUpRight size={13} className="text-faint group-hover:text-teal transition-colors" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Types for fetched inbox data                                       */
/* ------------------------------------------------------------------ */

type DashProposal = {
  id: string;
  title: string;
  client_name: string | null;
  recipient_name: string | null;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined';
  sent_at: string | null;
  last_viewed_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

type ReplyItem =
  | {
      kind: 'proposal';
      id: string;
      proposalId: string;
      proposalTitle: string;
      clientName: string;
      content: string;
      createdAt: string;
    }
  | {
      kind: 'review';
      id: string;
      projectId: string;
      itemId: string;
      itemTitle: string;
      clientName: string;
      content: string;
      createdAt: string;
    };

/* ------------------------------------------------------------------ */
/*  Dashboard content                                                  */
/* ------------------------------------------------------------------ */

interface DashboardContentProps {
  companyId: string;
  isSuperAdmin?: boolean;
  memberName?: string;
  accountType?: 'agency' | 'client';
}

function DashboardContent({ companyId, memberName, accountType }: DashboardContentProps) {
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<DashProposal[]>([]);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [toolCounts, setToolCounts] = useState({
    proposals: 0, quotes: 0, documents: 0, funnels: 0, metaConnections: 0, reviewProjects: 0,
  });

  const firstName = memberName?.split(' ')[0] || 'there';
  const isClient = accountType === 'client';

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [
        propsRes,
        propCommentsRes,
        reviewCommentsRes,
        quotesCount,
        documentsCount,
        funnelsCount,
        metaCount,
        reviewProjectsCount,
      ] = await Promise.all([
        supabase
          .from('proposals')
          .select('id, title, client_name, recipient_name, status, sent_at, last_viewed_at, accepted_at, created_at')
          .eq('company_id', companyId)
          .eq('entity_type', 'proposal')
          .order('created_at', { ascending: false }),
        supabase
          .from('proposal_comments')
          .select('id, content, created_at, author_name, proposal_id, proposals!inner(id, title, client_name)')
          .eq('company_id', companyId)
          .eq('author_type', 'client')
          .is('parent_id', null)
          .is('resolved_at', null)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('review_comments')
          .select('id, content, created_at, author_name, review_item_id, review_items!inner(id, title, review_project_id)')
          .eq('company_id', companyId)
          .eq('author_type', 'client')
          .is('parent_comment_id', null)
          .eq('resolved', false)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('entity_type', 'quote'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('funnels').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('meta_connections').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active'),
        supabase.from('review_projects').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active'),
      ]);

      const props = (propsRes.data || []) as DashProposal[];
      setProposals(props);

      const proposalReplies: ReplyItem[] = (propCommentsRes.data || []).map((c) => {
        // supabase JS embeds related rows; in the typed select they show up under the relation alias
        const rel = (c as unknown as { proposals: { id: string; title: string; client_name: string | null } }).proposals;
        return {
          kind: 'proposal' as const,
          id: c.id,
          proposalId: rel?.id ?? c.proposal_id,
          proposalTitle: rel?.title ?? 'Untitled proposal',
          clientName: c.author_name || rel?.client_name || 'Client',
          content: c.content,
          createdAt: c.created_at,
        };
      });

      const reviewReplies: ReplyItem[] = (reviewCommentsRes.data || []).map((c) => {
        const rel = (c as unknown as { review_items: { id: string; title: string; review_project_id: string } }).review_items;
        return {
          kind: 'review' as const,
          id: c.id,
          projectId: rel?.review_project_id,
          itemId: rel?.id ?? c.review_item_id,
          itemTitle: rel?.title ?? 'Review item',
          clientName: c.author_name || 'Client',
          content: c.content,
          createdAt: c.created_at,
        };
      });

      const merged = [...proposalReplies, ...reviewReplies].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setReplies(merged);

      setToolCounts({
        proposals: props.length,
        quotes: quotesCount.count || 0,
        documents: documentsCount.count || 0,
        funnels: funnelsCount.count || 0,
        metaConnections: metaCount.count || 0,
        reviewProjects: reviewProjectsCount.count || 0,
      });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  /* ── Derived buckets ───────────────────────────────────────── */

  const weekStart = startOfWeek();
  const twoDaysAgo = daysAgo(2);
  const fourteenDaysAgo = daysAgo(14);

  const warmLeads = proposals
    .filter((p) => p.status === 'viewed' && !p.accepted_at && p.last_viewed_at)
    .sort((a, b) => new Date(b.last_viewed_at!).getTime() - new Date(a.last_viewed_at!).getTime());

  const awaitingClient = proposals
    .filter((p) => p.status === 'sent' && p.sent_at && p.sent_at <= twoDaysAgo && !p.last_viewed_at)
    .sort((a, b) => new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime());

  const recentlyAccepted = proposals
    .filter((p) => p.accepted_at && p.accepted_at >= fourteenDaysAgo)
    .sort((a, b) => new Date(b.accepted_at!).getTime() - new Date(a.accepted_at!).getTime());

  const acceptedThisWeek = proposals.filter((p) => p.accepted_at && p.accepted_at >= weekStart).length;

  /* ── Client view (unchanged behavior) ─────────────────────── */

  if (isClient) {
    const totalCount = proposals.length;
    const acceptedCount = proposals.filter((p) => p.accepted_at).length;
    return (
      <div className="flex flex-col h-full">
        <div className="bg-ivory shadow-[0_1px_0_rgba(20,20,40,0.05)] px-6 lg:px-10 py-6 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{getGreeting()}, {firstName}</h1>
            <p className="text-sm text-muted mt-1">
              You have {totalCount - acceptedCount} proposals waiting for your review.
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            <StatCard label="Active Proposals" value={totalCount} icon={FileText} iconBg="#E6F5F3" iconColor="#017C87"
              footer={
                <div className="flex items-center gap-1">
                  <Timer size={14} className="text-teal" />
                  <span className="text-xs font-medium text-teal">{totalCount - acceptedCount} awaiting your review</span>
                </div>
              }
            />
            <StatCard label="Reviewed" value={acceptedCount} icon={CheckCircle2} iconBg="#E8F5E9" iconColor="#2E7D32"
              footer={
                <span className="text-xs font-medium text-faint">
                  {totalCount > 0 ? `${Math.round((acceptedCount / totalCount) * 100)}% acceptance rate` : 'No proposals yet'}
                </span>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Agency inbox view ────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-ivory shadow-[0_1px_0_rgba(20,20,40,0.05)] px-6 lg:px-10 py-6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{getGreeting()}, {firstName}</h1>
          <p className="text-sm text-muted mt-1">Here’s what needs your attention.</p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[220px]">
            <Search size={16} className="text-faint" />
            <span className="text-[13px] text-faint">Search...</span>
          </div>
          <button className="w-[38px] h-[38px] rounded-full border border-gray-100 bg-white flex items-center justify-center hover:bg-surface transition-colors">
            <Bell size={18} className="text-muted" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        <div className="flex flex-col gap-6">
          {/* Summary strip */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] p-5 h-[88px] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryPill label="Awaiting your reply" value={replies.length} icon={Reply} tone="urgent" />
              <SummaryPill label="Warm leads (viewed)" value={warmLeads.length} icon={Eye} tone="warm" />
              <SummaryPill label="Awaiting client (>2d)" value={awaitingClient.length} icon={Send} tone="neutral" />
              <SummaryPill label="Accepted this week" value={acceptedThisWeek} icon={Sparkles} tone="positive" />
            </div>
          )}

          {/* Needs your reply (full width) */}
          <InboxCard
            title="Needs your reply"
            count={replies.length}
            icon={Reply}
            iconColor="#92500F"
            emptyLabel="No open client comments — nice."
            viewAllHref={replies.length > 5 ? '/proposals' : undefined}
          >
            {replies.slice(0, 5).map((r, i, arr) => {
              const isLast = i === arr.length - 1;
              if (r.kind === 'proposal') {
                return (
                  <InboxRow
                    key={`p-${r.id}`}
                    href={`/proposals/${r.proposalId}`}
                    title={`${r.clientName} commented on ${r.proposalTitle}`}
                    subtitle={truncate(r.content, 120)}
                    meta={formatRelative(r.createdAt)}
                    badge={{ label: 'Proposal', bg: '#E6F5F3', color: '#017C87' }}
                    isLast={isLast}
                  />
                );
              }
              return (
                <InboxRow
                  key={`r-${r.id}`}
                  href={`/feedback/${r.projectId}/items/${r.itemId}`}
                  title={`${r.clientName} commented on ${r.itemTitle}`}
                  subtitle={truncate(r.content, 120)}
                  meta={formatRelative(r.createdAt)}
                  badge={{ label: 'Review', bg: '#F3E8FF', color: '#7C3AED' }}
                  isLast={isLast}
                />
              );
            })}
          </InboxCard>

          {/* Two-column: Warm leads + Awaiting client */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InboxCard
              title="Warm leads"
              count={warmLeads.length}
              icon={Eye}
              iconColor="#017C87"
              emptyLabel="Nothing viewed lately."
              viewAllHref={warmLeads.length > 5 ? '/proposals' : undefined}
            >
              {warmLeads.slice(0, 5).map((p, i, arr) => (
                <InboxRow
                  key={p.id}
                  href={`/proposals/${p.id}`}
                  title={p.title || 'Untitled Proposal'}
                  subtitle={`Viewed by ${p.client_name || p.recipient_name || 'client'}`}
                  meta={p.last_viewed_at ? formatRelative(p.last_viewed_at) : ''}
                  isLast={i === arr.length - 1}
                />
              ))}
            </InboxCard>

            <InboxCard
              title="Awaiting client (>2 days)"
              count={awaitingClient.length}
              icon={AlertCircle}
              iconColor="#6B6B6B"
              emptyLabel="Every sent proposal has been opened."
              viewAllHref={awaitingClient.length > 5 ? '/proposals' : undefined}
            >
              {awaitingClient.slice(0, 5).map((p, i, arr) => (
                <InboxRow
                  key={p.id}
                  href={`/proposals/${p.id}`}
                  title={p.title || 'Untitled Proposal'}
                  subtitle={`Sent to ${p.client_name || p.recipient_name || 'client'} · not opened yet`}
                  meta={p.sent_at ? formatRelative(p.sent_at) : ''}
                  isLast={i === arr.length - 1}
                />
              ))}
            </InboxCard>
          </div>

          {/* Recently accepted */}
          <InboxCard
            title="Recently accepted"
            count={recentlyAccepted.length}
            icon={CheckCircle2}
            iconColor="#2E7D32"
            emptyLabel="No proposals accepted in the last 14 days."
            viewAllHref={recentlyAccepted.length > 4 ? '/proposals' : undefined}
          >
            {recentlyAccepted.slice(0, 4).map((p, i, arr) => (
              <InboxRow
                key={p.id}
                href={`/proposals/${p.id}`}
                title={p.title || 'Untitled Proposal'}
                subtitle={`Accepted by ${p.client_name || p.recipient_name || 'client'}`}
                meta={p.accepted_at ? formatRelative(p.accepted_at) : ''}
                isLast={i === arr.length - 1}
              />
            ))}
          </InboxCard>

          {/* Tools strip */}
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted mb-3">Jump back in</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <ToolTile href="/proposals" label="Proposals" icon={FileText} iconBg="#E6F5F3" iconColor="#017C87" count={toolCounts.proposals} />
              <ToolTile href="/quotes" label="Quotes" icon={ReceiptText} iconBg="#FFF1E0" iconColor="#D97706" count={toolCounts.quotes} />
              <ToolTile href="/documents" label="Documents" icon={Files} iconBg="#EEF2FF" iconColor="#4F46E5" count={toolCounts.documents} />
              <ToolTile href="/feedback" label="Creative Reviews" icon={Layers} iconBg="#F3E8FF" iconColor="#7C3AED" count={toolCounts.reviewProjects} />
              <ToolTile href="/funnels" label="Funnels" icon={Workflow} iconBg="#FEE2E2" iconColor="#DC2626" count={toolCounts.funnels} />
              <ToolTile href="/integrations/looker-studio" label="Integrations" icon={Plug} iconBg="#E0F2FE" iconColor="#0284C7" count={toolCounts.metaConnections} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
