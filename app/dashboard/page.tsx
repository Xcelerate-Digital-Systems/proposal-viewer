// app/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText, CheckCircle2, Timer, Reply, ArrowRight, MessageSquareText,
} from 'lucide-react';
import { supabase, type Proposal, type FeedbackProject } from '@/lib/supabase';
import type { FeedbackStatus } from '@/lib/types/feedback';
import AdminLayout from '@/components/admin/AdminLayout';
import InboxItem, { type InboxComment } from '@/components/admin/dashboard/InboxItem';
import DashboardPipeline from '@/components/admin/dashboard/DashboardPipeline';
import FeedbackPipeline from '@/components/admin/dashboard/FeedbackPipeline';
import FeedbackActionWidgets from '@/components/admin/dashboard/FeedbackActionWidgets';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import { buildStatusPatch, type ProposalStatus } from '@/lib/proposals/status';
import { ReplayButton } from '@/components/tours/ReplayButton';

export default function DashboardPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <DashboardContent
          companyId={auth.companyId!}
          memberName={auth.teamMember?.name || 'You'}
          teamMemberId={auth.teamMember?.id ?? null}
          accountType={auth.accountType}
        />
      )}
    </AdminLayout>
  );
}

interface DashboardContentProps {
  companyId: string;
  memberName: string;
  teamMemberId: string | null;
  accountType?: 'agency' | 'client';
}

function DashboardContent({ companyId, memberName, teamMemberId, accountType }: DashboardContentProps) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<Proposal[]>([]);
  const [inbox, setInbox] = useState<InboxComment[]>([]);
  const [feedbackProjects, setFeedbackProjects] = useState<FeedbackProject[]>([]);
  const [feedbackItemCounts, setFeedbackItemCounts] = useState<Record<string, number>>({});

  const firstName = memberName.split(' ')[0] || 'there';
  const isClient = accountType === 'client';

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setFetchError(null);
    try {
      const [pipelineRes, reviewCommentsRes, feedbackProjectsRes, feedbackItemsRes] = await Promise.all([
        supabase
          .from('proposals')
          .select('*')
          .eq('company_id', companyId)
          .in('entity_type', ['proposal', 'quote'])
          .order('updated_at', { ascending: false }),
        supabase
          .from('review_comments')
          .select('id, content, created_at, author_name, screenshot_url, review_item_id, review_items!inner(id, title, review_project_id, company_id)')
          .eq('company_id', companyId)
          .eq('author_type', 'client')
          .eq('resolved', false)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('review_projects')
          .select('*')
          .eq('company_id', companyId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('review_items')
          .select('id, review_project_id')
          .eq('company_id', companyId),
      ]);

      setPipeline((pipelineRes.data || []) as Proposal[]);

      // Resolve review_project names in one bulk query so each inbox row can
      // show its "Project → Item" breadcrumb.
      type RawReviewComment = {
        id: string;
        content: string;
        created_at: string;
        author_name: string | null;
        screenshot_url: string | null;
        review_item_id: string;
        review_items: { id: string; title: string; review_project_id: string; company_id: string } | null;
      };
      const reviewRows = (reviewCommentsRes.data || []) as unknown as RawReviewComment[];
      const projectIds = Array.from(
        new Set(reviewRows.map((c) => c.review_items?.review_project_id).filter(Boolean) as string[]),
      );
      const projectNames: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: names } = await supabase
          .from('review_projects')
          .select('id, title')
          .in('id', projectIds);
        for (const p of names || []) projectNames[p.id] = p.title;
      }

      const inboxItems: InboxComment[] = reviewRows.map((c) => {
        const rel = c.review_items;
        const projectId = rel?.review_project_id ?? '';
        return {
          commentId: c.id,
          projectId,
          projectName: projectNames[projectId] ?? 'Markup project',
          itemId: rel?.id ?? c.review_item_id,
          itemTitle: rel?.title ?? 'Review item',
          clientName: c.author_name || 'Client',
          content: c.content,
          createdAt: c.created_at,
          screenshotUrl: c.screenshot_url ?? null,
          companyId: rel?.company_id ?? companyId,
        };
      });
      setInbox(inboxItems);

      setFeedbackProjects((feedbackProjectsRes.data || []) as FeedbackProject[]);

      const counts: Record<string, number> = {};
      for (const it of (feedbackItemsRes.data || []) as { review_project_id: string }[]) {
        counts[it.review_project_id] = (counts[it.review_project_id] ?? 0) + 1;
      }
      setFeedbackItemCounts(counts);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load your dashboard');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Optimistic pipeline mutation — mirrors /proposals page behaviour. Throws
  // on failure so the kanban can roll back.
  const movePipelineCard = async (id: string, next: ProposalStatus) => {
    const patch = buildStatusPatch(next);
    setPipeline((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...(patch as Partial<Proposal>) } : p)),
    );
    const { error } = await supabase.from('proposals').update(patch).eq('id', id);
    if (error) throw error;
  };

  const moveFeedbackCard = async (id: string, next: FeedbackStatus) => {
    setFeedbackProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: next } : p)),
    );
    const { error } = await supabase
      .from('review_projects')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const handleFeedbackDeleted = (id: string) => {
    setFeedbackProjects((prev) => prev.filter((p) => p.id !== id));
    setInbox((prev) => prev.filter((c) => c.projectId !== id));
  };

  const dismissInboxItem = (commentId: string) =>
    setInbox((prev) => prev.filter((c) => c.commentId !== commentId));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  /* ── Fetch error — render once for both client and agency views ─ */
  if (fetchError) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={`${getGreeting()}, ${firstName}`} />
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
          <ErrorState
            description={fetchError}
            onRetry={() => { setLoading(true); fetchData(); }}
          />
        </div>
      </div>
    );
  }

  /* ── Client view ──────────────────────────────────────── */
  if (isClient) {
    const totalCount = pipeline.length;
    const acceptedCount = pipeline.filter((p) => p.accepted_at).length;
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title={`${getGreeting()}, ${firstName}`}
          description={`You have ${totalCount - acceptedCount} proposals waiting for your review.`}
        />
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl shadow-card p-6 animate-enter-up" style={{ animationDelay: '0ms' }}>
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-muted" />
                <span className="text-caption font-medium text-muted">Active Proposals</span>
              </div>
              <p className="text-[32px] font-bold text-ink leading-none mt-3">{totalCount}</p>
              <div className="flex items-center gap-1 mt-3">
                <Timer size={14} className="text-muted" />
                <span className="text-xs font-medium text-muted">{totalCount - acceptedCount} awaiting your review</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-card p-6 animate-enter-up" style={{ animationDelay: '50ms' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-caption font-medium text-muted">Reviewed</span>
              </div>
              <p className="text-[32px] font-bold text-ink leading-none mt-3">{acceptedCount}</p>
              <span className="text-xs font-medium text-faint mt-3 block">
                {totalCount > 0 ? `${Math.round((acceptedCount / totalCount) * 100)}% acceptance rate` : 'No proposals yet'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Agency view ──────────────────────────────────────── */

  const proposalCount = pipeline.filter((p) => p.entity_type === 'proposal').length;
  const quoteCount = pipeline.length - proposalCount;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        description={
          loading
            ? 'Loading…'
            : inbox.length === 0
              ? 'Inbox zero — your pipelines are below.'
              : `${inbox.length} markup ${inbox.length === 1 ? 'comment needs' : 'comments need'} your reply.`
        }
        actions={<ReplayButton tourId="dashboard" />}
      />

      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
        <div className="flex flex-col gap-5">
          {/* ── Action widgets: Awaiting my review / Needs new version ─ */}
          <FeedbackActionWidgets companyId={companyId} teamMemberId={teamMemberId} />

          {/* ── Section 1: Feedback (inbox + kanban) ───────── */}
          <section
            data-tour="dashboard-feedback"
            className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col animate-enter-up"
            style={{ animationDelay: '50ms' }}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center">
                  <MessageSquareText size={14} className="text-muted" />
                </div>
                <h2 className="text-base font-semibold text-ink">Markup</h2>
                <span className="text-detail text-muted">
                  {feedbackProjects.length} {feedbackProjects.length === 1 ? 'project' : 'projects'}
                  {inbox.length > 0 && ` · ${inbox.length} awaiting reply`}
                </span>
              </div>
              <Link href="/markup" className="text-xs font-medium text-teal hover:underline inline-flex items-center gap-1">
                All projects <ArrowRight size={12} />
              </Link>
            </header>

            {/* Inbox sub-area */}
            <div>
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <Reply size={13} className="text-[#92500F]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Needs your reply
                </h3>
                {inbox.length > 0 && (
                  <span className="text-2xs font-semibold text-muted bg-surface rounded-full px-1.5 py-0.5">
                    {inbox.length}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="px-5 py-8 text-center text-caption text-muted">Loading…</div>
              ) : inbox.length === 0 ? (
                <div className="px-5 py-8 flex flex-col items-center text-center">
                  <CheckCircle2 size={20} className="text-emerald-500/70 mb-1.5" />
                  <p className="text-caption font-medium text-ink">All caught up</p>
                  <p className="text-detail text-muted mt-0.5">No unresolved client comments.</p>
                </div>
              ) : (
                <div className="border-t border-edge">
                  {inbox.slice(0, 8).map((c, i, arr) => (
                    <InboxItem
                      key={c.commentId}
                      item={c}
                      memberName={memberName}
                      isLast={i === Math.min(arr.length, 8) - 1}
                      onDismiss={() => dismissInboxItem(c.commentId)}
                    />
                  ))}
                  {inbox.length > 8 && (
                    <div className="px-5 py-3 border-t border-edge text-center">
                      <span className="text-xs text-muted">
                        Plus {inbox.length - 8} more — open them from their markup project.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kanban sub-area */}
            <div className="border-t border-edge">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <MessageSquareText size={13} className="text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Projects
                </h3>
                <span className="text-detail text-faint">Drag to update status</span>
              </div>

              {loading ? (
                <div className="px-5 py-12 text-center text-caption text-muted">Loading…</div>
              ) : feedbackProjects.length === 0 ? (
                <div className="px-5 py-12 flex flex-col items-center text-center">
                  <MessageSquareText size={24} className="text-faint mb-2" />
                  <p className="text-sm font-medium text-ink">No markup projects yet</p>
                  <p className="text-xs text-muted mt-1">Spin one up to start collecting client comments on creative.</p>
                  <Link href="/markup" className="inline-flex items-center gap-1.5 bg-teal hover:bg-teal-hover text-white text-xs font-semibold rounded-full px-3.5 py-1.5 mt-4">
                    New project
                  </Link>
                </div>
              ) : (
                <div className="px-5 pb-5 h-[520px]">
                  <FeedbackPipeline
                    projects={feedbackProjects}
                    itemCounts={feedbackItemCounts}
                    onMove={moveFeedbackCard}
                    onDeleted={handleFeedbackDeleted}
                  />
                </div>
              )}
            </div>
          </section>

          {/* ── Section 2: Proposals & Quotes pipeline ──────── */}
          <section
            data-tour="dashboard-proposals"
            className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col animate-enter-up"
            style={{ animationDelay: '100ms' }}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center">
                  <FileText size={14} className="text-muted" />
                </div>
                <h2 className="text-base font-semibold text-ink">Proposals &amp; Quotes</h2>
                <span className="text-detail text-muted">
                  {proposalCount} {proposalCount === 1 ? 'proposal' : 'proposals'} · {quoteCount} {quoteCount === 1 ? 'quote' : 'quotes'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/proposals" className="text-xs font-medium text-teal hover:underline inline-flex items-center gap-1">
                  Proposals <ArrowRight size={12} />
                </Link>
                <Link href="/quotes" className="text-xs font-medium text-teal hover:underline inline-flex items-center gap-1">
                  Quotes <ArrowRight size={12} />
                </Link>
              </div>
            </header>

            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-muted">Drag a card between columns to update its status.</p>
            </div>

            {loading ? (
              <div className="px-5 py-12 text-center text-caption text-muted">Loading pipeline…</div>
            ) : pipeline.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center text-center">
                <FileText size={24} className="text-faint mb-2" />
                <p className="text-sm font-medium text-ink">No proposals or quotes yet</p>
                <p className="text-xs text-muted mt-1">Create your first one to see it on the board.</p>
                <div className="flex items-center gap-2 mt-4">
                  <Link href="/proposals" className="inline-flex items-center gap-1.5 bg-teal hover:bg-teal-hover text-white text-xs font-semibold rounded-full px-3.5 py-1.5">
                    New proposal
                  </Link>
                  <Link href="/quotes" className="inline-flex items-center gap-1.5 bg-surface hover:bg-gray-100 text-ink text-xs font-semibold rounded-full px-3.5 py-1.5">
                    New quote
                  </Link>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5 h-[520px]">
                <DashboardPipeline items={pipeline} onMove={movePipelineCard} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
