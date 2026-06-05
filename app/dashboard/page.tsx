// app/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  FileText, CheckCircle2, Timer, Reply, ArrowRight, MessageSquareText, Check,
} from 'lucide-react';
import { supabase, type Proposal, type FeedbackProject } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import InboxItem, { type InboxComment } from '@/components/admin/dashboard/InboxItem';
import FeedbackActionWidgets from '@/components/admin/dashboard/FeedbackActionWidgets';
import PipelineSummary from '@/components/admin/dashboard/PipelineSummary';
import EmailActivityWidget from '@/components/admin/dashboard/EmailActivityWidget';
import ClientPipeline from '@/components/admin/dashboard/ClientPipeline';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import { PROPOSAL_STATUS_ORDER, PROPOSAL_STATUS_CONFIG } from '@/lib/proposals/status';
import { REVIEW_STATUS_ORDER, REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';
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

  const firstName = memberName.split(' ')[0] || 'there';
  const isClient = accountType === 'client';

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setFetchError(null);
    try {
      const [pipelineRes, reviewCommentsRes, feedbackProjectsRes] = await Promise.all([
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
          .is('parent_comment_id', null)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('review_projects')
          .select('*')
          .eq('company_id', companyId)
          .order('updated_at', { ascending: false }),
      ]);

      setPipeline((pipelineRes.data || []) as Proposal[]);

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

      const replyCounts: Record<string, number> = {};
      const commentIds = reviewRows.map((c) => c.id);
      if (commentIds.length > 0) {
        const { data: replyRows } = await supabase
          .from('review_comments')
          .select('parent_comment_id')
          .in('parent_comment_id', commentIds);
        for (const r of (replyRows || []) as { parent_comment_id: string }[]) {
          replyCounts[r.parent_comment_id] = (replyCounts[r.parent_comment_id] || 0) + 1;
        }
      }

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
          projectName: projectNames[projectId] ?? 'Campaign',
          itemId: rel?.id ?? c.review_item_id,
          itemTitle: rel?.title ?? 'Asset',
          clientName: c.author_name || 'Client',
          content: c.content,
          createdAt: c.created_at,
          screenshotUrl: c.screenshot_url ?? null,
          companyId: rel?.company_id ?? companyId,
          replyCount: replyCounts[c.id] || 0,
        };
      });
      setInbox(inboxItems);

      setFeedbackProjects((feedbackProjectsRes.data || []) as FeedbackProject[]);
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

  /* ── Undo-on-resolve ──────────────────────────────────── */

  const [undoItem, setUndoItem] = useState<InboxComment | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const undoItemRef = useRef<InboxComment | null>(null);

  const persistResolve = useCallback((commentId: string) => {
    supabase
      .from('review_comments')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: memberName })
      .eq('id', commentId)
      .then(() => {});
  }, [memberName]);

  const handleResolve = useCallback((item: InboxComment) => {
    setInbox(prev => prev.filter(c => c.commentId !== item.commentId));
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoItemRef.current) persistResolve(undoItemRef.current.commentId);
    undoItemRef.current = item;
    setUndoItem(item);
    undoTimerRef.current = setTimeout(() => {
      persistResolve(item.commentId);
      undoItemRef.current = null;
      setUndoItem(null);
    }, 5000);
  }, [persistResolve]);

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const pending = undoItemRef.current;
    if (pending) {
      setInbox(prev =>
        [pending, ...prev].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    }
    undoItemRef.current = null;
    setUndoItem(null);
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (undoItemRef.current) persistResolve(undoItemRef.current.commentId);
    };
  }, [persistResolve]);

  /* ── Helpers ──────────────────────────────────────────── */

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

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
    const nonDraft = pipeline.filter((p) => p.status !== 'draft');
    const proposals = nonDraft.filter((p) => p.entity_type === 'proposal');
    const quotes = nonDraft.filter((p) => p.entity_type === 'quote');
    const sentCount = nonDraft.filter((p) => p.status === 'sent').length;
    const viewedCount = nonDraft.filter((p) => p.status === 'viewed').length;
    const acceptedCount = nonDraft.filter((p) => p.status === 'accepted').length;
    const awaitingAction = sentCount + viewedCount;

    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title={`${getGreeting()}, ${firstName}`}
          description={
            loading
              ? 'Loading…'
              : awaitingAction > 0
                ? `You have ${awaitingAction} ${awaitingAction === 1 ? 'item' : 'items'} awaiting your review.`
                : nonDraft.length === 0
                  ? 'No proposals or quotes yet.'
                  : 'All caught up.'
          }
        />
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Timer} iconClass="text-amber-500" label="Awaiting Review" value={awaitingAction} />
              <StatCard icon={CheckCircle2} iconClass="text-emerald-600" label="Accepted" value={acceptedCount} />
              <StatCard icon={FileText} iconClass="text-muted" label="Proposals" value={proposals.length} />
              <StatCard icon={FileText} iconClass="text-muted" label="Quotes" value={quotes.length} />
            </div>

            <section className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col">
              <header className="flex items-center justify-between px-5 py-4 border-b border-edge">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center">
                    <FileText size={14} className="text-muted" />
                  </div>
                  <h2 className="text-base font-semibold text-ink">Proposals &amp; Quotes</h2>
                  <span className="text-detail text-muted">
                    {proposals.length} {proposals.length === 1 ? 'proposal' : 'proposals'} · {quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'}
                  </span>
                </div>
              </header>

              {loading ? (
                <div className="px-5 py-6 space-y-3 animate-pulse">
                  <div className="h-3 bg-edge rounded w-1/4" />
                  <div className="h-16 bg-edge rounded-xl" />
                  <div className="h-16 bg-edge rounded-xl" />
                </div>
              ) : nonDraft.length === 0 ? (
                <div className="px-5 py-12 flex flex-col items-center text-center">
                  <FileText size={24} className="text-faint mb-2" />
                  <p className="text-sm font-medium text-ink">No proposals or quotes yet</p>
                  <p className="text-xs text-muted mt-1">When your agency sends you a proposal or quote, it will appear here.</p>
                </div>
              ) : (
                <div className="pb-5 h-[60vh] min-h-[320px]">
                  <ClientPipeline items={nonDraft} />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  /* ── Agency view ──────────────────────────────────────── */

  const proposalSegments = PROPOSAL_STATUS_ORDER.map((s) => ({
    key: s,
    label: PROPOSAL_STATUS_CONFIG[s].label,
    hex: PROPOSAL_STATUS_CONFIG[s].hex,
    count: pipeline.filter((p) => p.status === s).length,
  }));

  const feedbackSegments = REVIEW_STATUS_ORDER.map((s) => ({
    key: s,
    label: REVIEW_STATUS_CONFIG[s].label,
    hex: REVIEW_STATUS_CONFIG[s].hex,
    count: feedbackProjects.filter((p) => p.status === s).length,
  }));

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        description={
          loading
            ? 'Loading…'
            : inbox.length === 0
              ? 'Nothing needs your attention right now.'
              : `${inbox.length} client ${inbox.length === 1 ? 'comment needs' : 'comments need'} your reply.`
        }
        actions={<ReplayButton tourId="dashboard" />}
      />

      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
          {/* ── Primary: Inbox ────────────────────────────── */}
          <section
            data-tour="dashboard-feedback"
            className="bg-white rounded-2xl shadow-card overflow-hidden"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center">
                  <Reply size={14} className="text-amber-600" />
                </div>
                <h2 className="text-sm font-semibold text-ink">Client comments</h2>
                {inbox.length > 0 && (
                  <span className="text-2xs font-semibold text-white bg-amber-500 rounded-full px-1.5 py-0.5 leading-none">
                    {inbox.length}
                  </span>
                )}
              </div>
              <Link
                href="/campaigns"
                className="text-xs font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1"
              >
                All campaigns <ArrowRight size={12} />
              </Link>
            </header>

            {undoItem && (
              <div className="flex items-center gap-3 px-5 py-2.5 bg-surface border-b border-edge">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span className="text-caption text-ink flex-1">
                  Comment by {undoItem.clientName} resolved
                </span>
                <button
                  onClick={handleUndo}
                  className="text-caption font-semibold text-primary hover:text-primary-hover"
                >
                  Undo
                </button>
              </div>
            )}

            {loading ? (
              <div className="px-5 py-4 space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-edge shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-edge rounded w-1/3" />
                      <div className="h-3 bg-edge rounded w-2/3" />
                      <div className="h-3 bg-edge rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : inbox.length === 0 ? (
              <div className="px-5 py-8 flex flex-col items-center text-center">
                <CheckCircle2 size={20} className="text-emerald-500/70 mb-1.5" />
                <p className="text-caption font-medium text-ink">All caught up</p>
                <p className="text-detail text-muted mt-0.5">No unresolved client comments.</p>
              </div>
            ) : (
              <div>
                {inbox.slice(0, 10).map((c, i, arr) => (
                  <InboxItem
                    key={c.commentId}
                    item={c}
                    memberName={memberName}
                    isLast={i === Math.min(arr.length, 10) - 1}
                    onResolve={handleResolve}
                  />
                ))}
                {inbox.length > 10 && (
                  <div className="px-5 py-3 border-t border-edge">
                    <Link
                      href="/campaigns"
                      className="text-xs font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1"
                    >
                      View all {inbox.length} comments <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Sidebar: action widgets + pipeline ─────── */}
          <div className="flex flex-col gap-4">
            <FeedbackActionWidgets companyId={companyId} teamMemberId={teamMemberId} />

            <div
              data-tour="dashboard-proposals"
              className="flex flex-col gap-4"
            >
              <PipelineSummary
                icon={MessageSquareText}
                title="Campaigns"
                href="/campaigns"
                linkLabel="View pipeline"
                segments={feedbackSegments}
                total={feedbackProjects.length}
              />
              <PipelineSummary
                icon={FileText}
                title="Proposals & Quotes"
                href="/proposals"
                linkLabel="View pipeline"
                segments={proposalSegments}
                total={pipeline.length}
              />
            </div>

            <EmailActivityWidget companyId={companyId} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared client stat card ─────────────────────────────── */

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={iconClass} />
        <span className="text-caption font-medium text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink leading-none">{value}</p>
    </div>
  );
}
