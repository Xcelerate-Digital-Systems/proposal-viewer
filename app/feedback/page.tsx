'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquareText, LayoutGrid, List, Search, KanbanSquare, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
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

type FilterTab = 'active' | 'completed' | 'archived' | 'all';

const FILTER_STATUSES: Record<FilterTab, FeedbackStatus[] | null> = {
  active: ['draft', 'in_progress', 'internal_review', 'client_review', 'revision_needed'],
  completed: ['approved', 'rejected'],
  archived: ['archived'],
  all: null,
};

function ReviewsContent({ companyId, userId }: { companyId: string; userId: string | null }) {
  const [projects, setProjects] = useState<FeedbackProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('active');
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
      let query = supabase
        .from('review_projects')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });

      const statuses = FILTER_STATUSES[filter];
      if (statuses) {
        query = query.in('status', statuses);
      }

      const [projectsResult, domainResult] = await Promise.all([
        query,
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
      console.error('Failed to fetch projects:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    setLoading(true);
    fetchProjects();
  }, [fetchProjects]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'archived', label: 'Archived' },
    { key: 'all', label: 'All' },
  ];

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
      <div className="bg-ivory px-6 lg:px-10 py-6 shadow-divider">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Markup
            </h1>
            <p className="text-sm text-muted mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
              />
            </div>

            {/* New project */}
            <Button
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowCreate(true)}
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-ink text-white'
                  : 'text-muted hover:text-ink hover:bg-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — board needs overflow-hidden so its column heights resolve
          and the horizontal scroll stays inside the board. List/grid keep
          the normal vertical scroll. */}
      <div className={`flex-1 px-6 lg:px-10 ${viewMode === 'board' ? 'pt-4 pb-8 overflow-hidden' : 'py-8 overflow-y-auto'}`}>
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
          <NoResults message={`No projects matching “${searchQuery}”`} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title={filter === 'active' ? 'No active markup projects' : `No ${filter} projects`}
            description={
              filter === 'active'
                ? 'Create a project to start collecting markup on your creative work.'
                : 'Projects will appear here when their status changes.'
            }
            action={
              filter === 'active' ? (
                <Button size="sm" leftIcon={Plus} onClick={() => setShowCreate(true)}>
                  New Project
                </Button>
              ) : undefined
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
            emptyMessage="Drag a project here."
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
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-teal/10">
          <MessageSquareText size={15} className="text-teal" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-medium text-ink truncate leading-tight">
            {project.title}
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {project.client_name || 'Feedback project'}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <Calendar size={11} />
          <span>{relativeShort(updated)}</span>
        </div>
        <Link
          href={`/feedback/${project.id}/feedback`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 inline-flex items-center gap-1 text-[11px] font-medium text-teal hover:text-teal-hover"
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