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
import { buildStatusPatch, type ProposalStatus } from '@/lib/proposals/status';

export default function DashboardPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <DashboardContent
          companyId={auth.companyId!}
          memberName={auth.teamMember?.name || 'You'}
          accountType={auth.accountType}
        />
      )}
    </AdminLayout>
  );
}

interface DashboardContentProps {
  companyId: string;
  memberName: string;
  accountType?: 'agency' | 'client';
}

function DashboardContent({ companyId, memberName, accountType }: DashboardContentProps) {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Proposal[]>([]);
  const [inbox, setInbox] = useState<InboxComment[]>([]);
  const [feedbackProjects, setFeedbackProjects] = useState<FeedbackProject[]>([]);
  const [feedbackItemCounts, setFeedbackItemCounts] = useState<Record<string, number>>({});

  const firstName = memberName.split(' ')[0] || 'there';
  const isClient = accountType === 'client';

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [
        pipelineRes,
        proposalCommentsRes,
        reviewCommentsRes,
        feedbackProjectsRes,
        feedbackItemsRes,
      ] = await Promise.all([
        supabase
          .from('proposals')
          .select('*')
          .eq('company_id', companyId)
          .in('entity_type', ['proposal', 'quote'])
          .order('updated_at', { ascending: false }),
        supabase
          .from('proposal_comments')
          .select('id, content, created_at, author_name, page_number, proposal_id, proposals!inner(id, title, client_name, company_id)')
          .eq('company_id', companyId)
          .eq('author_type', 'client')
          .is('resolved_at', null)
          .order('created_at', { ascending: false })
          .limit(20),
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

      // Resolve review_project names in one bulk query so we can show
      // "Project → Item" breadcrumbs on each review inbox row.
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
        const { data: projects } = await supabase
          .from('review_projects')
          .select('id, title')
          .in('id', projectIds);
        for (const p of projects || []) projectNames[p.id] = p.title;
      }

      const proposalItems: InboxComment[] = (proposalCommentsRes.data || []).map((c) => {
        const rel = (c as unknown as {
          proposals: { id: string; title: string; client_name: string | null; company_id: string };
        }).proposals;
        return {
          kind: 'proposal' as const,
          commentId: c.id,
          proposalId: rel?.id ?? c.proposal_id,
          proposalTitle: rel?.title ?? 'Untitled proposal',
          clientName: c.author_name || rel?.client_name || 'Client',
          content: c.content,
          createdAt: c.created_at,
          pageNumber: c.page_number ?? null,
          companyId: rel?.company_id ?? companyId,
        };
      });

      const reviewItems: InboxComment[] = reviewRows.map((c) => {
        const rel = c.review_items;
        const projectId = rel?.review_project_id ?? '';
        return {
          kind: 'review' as const,
          commentId: c.id,
          projectId,
          projectName: projectNames[projectId] ?? 'Feedback project',
          itemId: rel?.id ?? c.review_item_id,
          itemTitle: rel?.title ?? 'Review item',
          clientName: c.author_name || 'Client',
          content: c.content,
          createdAt: c.created_at,
          screenshotUrl: c.screenshot_url ?? null,
          companyId: rel?.company_id ?? companyId,
        };
      });

      const merged = [...proposalItems, ...reviewItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setInbox(merged);

      setFeedbackProjects((feedbackProjectsRes.data || []) as FeedbackProject[]);

      const counts: Record<string, number> = {};
      for (const it of (feedbackItemsRes.data || []) as { review_project_id: string }[]) {
        counts[it.review_project_id] = (counts[it.review_project_id] ?? 0) + 1;
      }
      setFeedbackItemCounts(counts);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
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

  const dismissInboxItem = (commentId: string) =>
    setInbox((prev) => prev.filter((c) => c.commentId !== commentId));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  /* ── Client view ──────────────────────────────────────── */
  if (isClient) {
    const totalCount = pipeline.length;
    const acceptedCount = pipeline.filter((p) => p.accepted_at).length;
    return (
      <div className="flex flex-col h-full">
        <div className="bg-ivory shadow-[0_1px_0_rgba(20,20,40,0.05)] px-6 lg:px-10 py-6">
          <h1 className="text-2xl font-semibold text-ink">{getGreeting()}, {firstName}</h1>
          <p className="text-sm text-muted mt-1">
            You have {totalCount - acceptedCount} proposals waiting for your review.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] p-6">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-teal" />
                <span className="text-[13px] font-medium text-muted">Active Proposals</span>
              </div>
              <p className="text-[32px] font-bold text-ink leading-none mt-3">{totalCount}</p>
              <div className="flex items-center gap-1 mt-3">
                <Timer size={14} className="text-teal" />
                <span className="text-xs font-medium text-teal">{totalCount - acceptedCount} awaiting your review</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-[13px] font-medium text-muted">Reviewed</span>
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
      <div className="bg-ivory shadow-[0_1px_0_rgba(20,20,40,0.05)] px-6 lg:px-10 py-6">
        <h1 className="text-2xl font-semibold text-ink">{getGreeting()}, {firstName}</h1>
        <p className="text-sm text-muted mt-1">
          {loading
            ? 'Loading your inbox…'
            : inbox.length === 0
              ? 'Inbox zero — your pipelines are below.'
              : `${inbox.length} ${inbox.length === 1 ? 'comment needs' : 'comments need'} your reply.`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        <div className="flex flex-col gap-8">
          {/* ── Section 1: Inbox ────────────────────────────── */}
          <section className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] overflow-hidden">
            <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#FFF8E1] flex items-center justify-center">
                  <Reply size={14} className="text-[#92500F]" />
                </div>
                <h2 className="text-[15px] font-semibold text-ink">Needs your reply</h2>
                {inbox.length > 0 && (
                  <span className="text-[11px] font-semibold text-muted bg-surface rounded-full px-2 py-0.5">
                    {inbox.length}
                  </span>
                )}
              </div>
            </header>

            {loading ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted">Loading…</div>
            ) : inbox.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center text-center">
                <CheckCircle2 size={24} className="text-emerald-500/70 mb-2" />
                <p className="text-[14px] font-medium text-ink">All caught up</p>
                <p className="text-[12px] text-muted mt-1">No unresolved client comments.</p>
              </div>
            ) : (
              <>
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
                  <div className="px-5 py-3 border-t border-gray-100 text-center">
                    <span className="text-[12px] text-muted">
                      Plus {inbox.length - 8} more — open them from their proposal or feedback project.
                    </span>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Section 2: Proposals & Quotes pipeline ──────── */}
          <section className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] overflow-hidden flex flex-col">
            <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#E6F5F3] flex items-center justify-center">
                  <FileText size={14} className="text-[#017C87]" />
                </div>
                <h2 className="text-[15px] font-semibold text-ink">Proposals &amp; Quotes</h2>
                <span className="text-[11px] text-muted">
                  {proposalCount} {proposalCount === 1 ? 'proposal' : 'proposals'} · {quoteCount} {quoteCount === 1 ? 'quote' : 'quotes'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/proposals" className="text-[12px] font-medium text-teal hover:underline inline-flex items-center gap-1">
                  Proposals <ArrowRight size={12} />
                </Link>
                <Link href="/quotes" className="text-[12px] font-medium text-teal hover:underline inline-flex items-center gap-1">
                  Quotes <ArrowRight size={12} />
                </Link>
              </div>
            </header>

            <div className="px-5 pt-4 pb-2">
              <p className="text-[12px] text-muted">Drag a card between columns to update its status.</p>
            </div>

            {loading ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted">Loading pipeline…</div>
            ) : pipeline.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center text-center">
                <FileText size={24} className="text-faint mb-2" />
                <p className="text-[14px] font-medium text-ink">No proposals or quotes yet</p>
                <p className="text-[12px] text-muted mt-1">Create your first one to see it on the board.</p>
                <div className="flex items-center gap-2 mt-4">
                  <Link href="/proposals" className="inline-flex items-center gap-1.5 bg-teal hover:bg-teal-hover text-white text-[12px] font-semibold rounded-full px-3.5 py-1.5">
                    New proposal
                  </Link>
                  <Link href="/quotes" className="inline-flex items-center gap-1.5 bg-surface hover:bg-gray-100 text-ink text-[12px] font-semibold rounded-full px-3.5 py-1.5">
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

          {/* ── Section 3: Feedback pipeline ─────────────────── */}
          <section className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] overflow-hidden flex flex-col">
            <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <MessageSquareText size={14} className="text-purple-600" />
                </div>
                <h2 className="text-[15px] font-semibold text-ink">Feedback</h2>
                <span className="text-[11px] text-muted">
                  {feedbackProjects.length} {feedbackProjects.length === 1 ? 'project' : 'projects'}
                </span>
              </div>
              <Link href="/feedback" className="text-[12px] font-medium text-teal hover:underline inline-flex items-center gap-1">
                All projects <ArrowRight size={12} />
              </Link>
            </header>

            <div className="px-5 pt-4 pb-2">
              <p className="text-[12px] text-muted">
                Project-level pipeline — drag to update status. Open a project to see its per-item kanban.
              </p>
            </div>

            {loading ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted">Loading…</div>
            ) : feedbackProjects.length === 0 ? (
              <div className="px-5 py-12 flex flex-col items-center text-center">
                <MessageSquareText size={24} className="text-faint mb-2" />
                <p className="text-[14px] font-medium text-ink">No feedback projects yet</p>
                <p className="text-[12px] text-muted mt-1">Spin one up to start collecting client feedback on creative.</p>
                <Link href="/feedback" className="inline-flex items-center gap-1.5 bg-teal hover:bg-teal-hover text-white text-[12px] font-semibold rounded-full px-3.5 py-1.5 mt-4">
                  New project
                </Link>
              </div>
            ) : (
              <div className="px-5 pb-5 h-[520px]">
                <FeedbackPipeline
                  projects={feedbackProjects}
                  itemCounts={feedbackItemCounts}
                  onMove={moveFeedbackCard}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
