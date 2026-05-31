'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquareText, LayoutGrid, List, Search, KanbanSquare, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import NoResults from '@/components/ui/NoResults';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import type { FeedbackStatus } from '@/lib/types/feedback';
import AdminLayout from '@/components/admin/AdminLayout';
import CreateFeedbackProjectModal from '@/components/admin/feedback/CreateFeedbackProjectModal';
import FeedbackProjectCard from '@/components/admin/feedback/FeedbackProjectCard';
import FeedbackProjectRow from '@/components/admin/feedback/FeedbackProjectRow';
import KanbanBoard, { type KanbanColumn } from '@/components/kanban/KanbanBoard';
import { REVIEW_STATUS_ORDER, REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';

export default function ReviewsPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <ReviewsGate
          accountType={auth.accountType}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

// Feedback is an agency-side tool. All agency members get access; client
// accounts don't have feedback projects so they bounce. Was previously
// super-admin-only — a leftover gate that broke navigation as soon as
// the user joined a second agency.
function ReviewsGate({ accountType, companyId, userId }: { accountType?: 'agency' | 'client'; companyId: string; userId: string | null }) {
  const router = useRouter();
  const allowed = accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;

  return <ReviewsContent companyId={companyId} userId={userId} />;
}

function ReviewsContent({ companyId, userId }: { companyId: string; userId: string | null }) {
  const [projects, setProjects] = useState<FeedbackProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'board'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agencyviz-reviews-view');
      if (stored === 'grid' || stored === 'list' || stored === 'board') return stored;
    }
    return 'board';
  });

  const toggleView = (mode: 'grid' | 'list' | 'board') => {
    setViewMode(mode);
    localStorage.setItem('agencyviz-reviews-view', mode);
  };

  // Optimistic status update — drag-to-column on the board uses this.
  const updateProjectStatus = async (projectId: string, nextStatus: FeedbackStatus) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p)),
    );
    const { error } = await supabase
      .from('review_projects')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (error) throw error;
  };

  const fetchProjects = useCallback(async () => {
    if (!companyId) return;
    setFetchError(null);
    try {
      // No status filter at the page level — the per-project status lives in
      // the kanban / status pill. Mixing a project-level filter on top would
      // double up on the same dimension.
      const [projectsResult, domainResult] = await Promise.all([
        supabase
          .from('review_projects')
          .select('*')
          .eq('company_id', companyId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('companies')
          .select('custom_domain, domain_verified')
          .eq('id', companyId)
          .single(),
      ]);

      if (projectsResult.error) throw projectsResult.error;
      setProjects(projectsResult.data || []);

      const domainData = domainResult.data;
      if (domainData?.domain_verified && domainData.custom_domain) {
        setCustomDomain(domainData.custom_domain);
      } else {
        setCustomDomain(null);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchProjects();
  }, [fetchProjects]);

  const filtered = searchQuery
    ? projects.filter((p) =>
        (p.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : projects;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        title="Campaigns"
        description={`${projects.length} campaign${projects.length !== 1 ? 's' : ''}`}
        actions={<>
          {/* View toggle */}
            <div className="flex items-center bg-surface rounded-full p-1 gap-0.5">
              <button
                onClick={() => toggleView('grid')}
                className={`w-[34px] h-[30px] rounded-full flex items-center justify-center transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => toggleView('list')}
                className={`w-[34px] h-[30px] rounded-full flex items-center justify-center transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => toggleView('board')}
                className={`w-[34px] h-[30px] rounded-full flex items-center justify-center transition-all ${
                  viewMode === 'board'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="Board view"
              >
                <KanbanSquare size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[220px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
              <Search size={15} className="text-faint shrink-0" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-caption text-ink placeholder-faint outline-none w-full"
              />
            </div>

            {/* New project */}
            <div data-tour="campaigns-new">
              <Button
                size="sm"
                leftIcon={Plus}
                onClick={() => setShowCreate(true)}
              >
                New Campaign
              </Button>
            </div>
        </>}
      />

      {/* Content — board needs overflow-hidden so its column heights resolve
          and the horizontal scroll stays inside the board. List/grid keep
          the normal vertical scroll. */}
      <div data-tour="campaigns-list" className={`flex-1 px-6 lg:px-10 ${viewMode === 'board' ? 'pt-4 pb-8 overflow-hidden' : 'py-8 overflow-y-auto'}`}>
        {showCreate && (
          <CreateFeedbackProjectModal
            companyId={companyId}
            userId={userId}
            onClose={() => setShowCreate(false)}
            onSuccess={fetchProjects}
          />
        )}

        {loading ? (
          <EntityListSkeleton viewMode={viewMode === 'board' ? 'grid' : viewMode} />
        ) : fetchError ? (
          <ErrorState
            description={fetchError}
            onRetry={() => { setLoading(true); fetchProjects(); }}
          />
        ) : filtered.length === 0 && searchQuery ? (
          <NoResults message={`No campaigns matching “${searchQuery}”`} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No campaigns yet"
            description="Create a campaign to start collecting feedback on your creative work."
            action={
              <Button size="sm" leftIcon={Plus} onClick={() => setShowCreate(true)}>
                New Campaign
              </Button>
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((project) => (
              <FeedbackProjectCard
                key={project.id}
                project={project}
                onRefresh={fetchProjects}
                customDomain={customDomain}
              />
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filtered.map((project) => (
              <FeedbackProjectRow
                key={project.id}
                project={project}
                onRefresh={fetchProjects}
                customDomain={customDomain}
              />
            ))}
          </div>
        ) : (
          <KanbanBoard
            columns={
              REVIEW_STATUS_ORDER.map<KanbanColumn<FeedbackProject>>((status) => ({
                id: status,
                label: REVIEW_STATUS_CONFIG[status].label,
                accentHex: REVIEW_STATUS_CONFIG[status].hex,
                items: filtered.filter((p) => p.status === status),
              }))
            }
            renderCard={(project) => <FeedbackBoardCard project={project} />}
            onMove={(projectId, _from, to) => updateProjectStatus(projectId, to as FeedbackStatus)}
            emptyMessage="Drag a campaign here."
          />
        )}
      </div>
    </div>
  );
}

/* ─── Card used on the kanban board ───────────────────────
   Mirrors the in-project KanbanCard styling (white rounded-2xl with the
   double-layer shadow, icon tile in the top-left, footer divided by a
   light border with meta on the left + Open link on the right). */

function FeedbackBoardCard({ project }: { project: FeedbackProject }) {
  const updated = project.updated_at || project.created_at;
  return (
    <div className="group relative bg-white rounded-2xl shadow-card-soft hover:shadow-card-hover p-3.5 transition-all">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center bg-teal/10">
          <MessageSquareText size={15} className="text-teal" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-caption font-medium text-ink truncate leading-tight">
            {project.title}
          </h4>
          <p className="text-detail text-faint mt-0.5 truncate">
            {project.client_name || 'Campaign'}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
        <div className="flex items-center gap-1 text-detail text-dim">
          <Calendar size={11} />
          <span>{relativeShort(updated)}</span>
        </div>
        <Link
          href={`/campaigns/${project.id}/comments`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 inline-flex items-center gap-1 text-detail font-medium text-teal hover:text-teal-hover"
        >
          <ExternalLink size={11} />
          Open
        </Link>
      </div>
    </div>
  );
}

function relativeShort(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}