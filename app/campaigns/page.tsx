'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquareText, LayoutGrid, List, Search, KanbanSquare, ExternalLink, Calendar, MoreHorizontal, Pencil, Trash2, Copy, Check, ChevronDown, Workflow, Layers, FileCheck, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import NoResults from '@/components/ui/NoResults';
import EntityListSkeleton from '@/components/ui/EntityListSkeleton';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import type { FeedbackStatus, ProjectType } from '@/lib/types/feedback';
import AdminLayout from '@/components/admin/AdminLayout';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { buildReviewUrl } from '@/lib/proposal-url';
import CreateFeedbackProjectModal from '@/components/admin/feedback/CreateFeedbackProjectModal';
import CreateStandaloneAssetModal from '@/components/admin/feedback/CreateStandaloneAssetModal';
import CreateWebsiteProjectModal from '@/components/admin/feedback/CreateWebsiteProjectModal';
import FeedbackProjectCard from '@/components/admin/feedback/FeedbackProjectCard';
import FeedbackProjectRow from '@/components/admin/feedback/FeedbackProjectRow';
import KanbanBoard, { type KanbanColumn } from '@/components/kanban/KanbanBoard';
import { REVIEW_STATUS_ORDER, REVIEW_STATUS_CONFIG } from '@/lib/feedback/status';
import WorkflowTemplatesManager from '@/components/admin/feedback/WorkflowTemplatesManager';

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

type SortOption = 'updated' | 'created' | 'name_asc' | 'name_desc' | 'due_date';

function ReviewsContent({ companyId, userId }: { companyId: string; userId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<FeedbackProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Filter & sort state from URL params
  const searchQuery = searchParams.get('q') || '';
  const statusFilter = (searchParams.get('status') || '') as FeedbackStatus | '';
  const typeFilter = (searchParams.get('type') || '') as ProjectType | '';
  const clientFilter = searchParams.get('client') || '';
  const sortBy = (searchParams.get('sort') || 'updated') as SortOption;

  // Close create menu on outside click
  useEffect(() => {
    if (!showCreateMenu) return;
    const handler = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCreateMenu]);

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

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

  // Unique client names for the client filter dropdown
  const clientOptions = useMemo(() => {
    const names = new Set<string>();
    projects.forEach((p) => {
      const name = p.client_company || p.client_name;
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = projects;

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        (p.title?.toLowerCase() || '').includes(q) ||
        (p.description?.toLowerCase() || '').includes(q) ||
        (p.client_name?.toLowerCase() || '').includes(q) ||
        (p.client_company?.toLowerCase() || '').includes(q)
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Type filter
    if (typeFilter) {
      result = result.filter((p) => (p.project_type ?? 'campaign') === typeFilter);
    }

    // Client filter
    if (clientFilter) {
      result = result.filter((p) =>
        (p.client_company || p.client_name) === clientFilter
      );
    }

    // Sort
    const sorted = [...result];
    switch (sortBy) {
      case 'created':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'name_asc':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'name_desc':
        sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'due_date':
        sorted.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
        break;
      case 'updated':
      default:
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
    }

    return sorted;
  }, [projects, searchQuery, statusFilter, typeFilter, clientFilter, sortBy]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        title="Campaigns"
        description={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={<>
          {/* View toggle */}
            <div className="flex items-center bg-surface rounded-full p-1 gap-0.5" role="group" aria-label="View mode">
              <button
                onClick={() => toggleView('grid')}
                className={`w-[34px] h-[30px] rounded-full flex items-center justify-center transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => toggleView('list')}
                className={`w-[34px] h-[30px] rounded-full flex items-center justify-center transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <List size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => toggleView('board')}
                className={`w-[34px] h-[30px] rounded-full flex items-center justify-center transition-all ${
                  viewMode === 'board'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                aria-label="Board view"
                aria-pressed={viewMode === 'board'}
              >
                <KanbanSquare size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-surface rounded-full px-4 py-2 w-[220px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
              <Search size={15} className="text-faint shrink-0" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => updateParam('q', e.target.value)}
                className="bg-transparent text-caption text-ink placeholder-faint outline-none w-full"
                aria-label="Search campaigns"
              />
            </div>

            {/* Status filter */}
            <div className="relative hidden md:block">
              <select
                value={statusFilter}
                onChange={(e) => updateParam('status', e.target.value)}
                className="appearance-none bg-surface text-caption text-ink rounded-full pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-teal/20 transition-all cursor-pointer"
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {REVIEW_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{REVIEW_STATUS_CONFIG[s].label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            </div>

            {/* Type filter */}
            <div className="relative hidden md:block">
              <select
                value={typeFilter}
                onChange={(e) => updateParam('type', e.target.value)}
                className="appearance-none bg-surface text-caption text-ink rounded-full pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-teal/20 transition-all cursor-pointer"
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                <option value="campaign">Campaigns</option>
                <option value="asset">Assets</option>
                <option value="website">Websites</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            </div>

            {/* Client filter */}
            {clientOptions.length > 0 && (
              <div className="relative hidden md:block">
                <select
                  value={clientFilter}
                  onChange={(e) => updateParam('client', e.target.value)}
                  className="appearance-none bg-surface text-caption text-ink rounded-full pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-teal/20 transition-all cursor-pointer max-w-[180px] truncate"
                  aria-label="Filter by client"
                >
                  <option value="">All clients</option>
                  {clientOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              </div>
            )}

            {/* Sort */}
            <div className="relative hidden md:block">
              <select
                value={sortBy}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="appearance-none bg-surface text-caption text-ink rounded-full pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-teal/20 transition-all cursor-pointer"
                aria-label="Sort campaigns"
              >
                <option value="updated">Recently updated</option>
                <option value="created">Recently created</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="due_date">Due date</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            </div>

            {/* Templates */}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={Workflow}
              onClick={() => setShowTemplates(true)}
            >
              Templates
            </Button>

            {/* New project */}
            <div data-tour="campaigns-new" className="relative" ref={createMenuRef}>
              <Button
                size="sm"
                leftIcon={Plus}
                onClick={() => setShowCreateMenu(!showCreateMenu)}
              >
                Create New
                <ChevronDown size={13} className="ml-1 -mr-1" />
              </Button>
              {showCreateMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-edge bg-white shadow-lg py-1.5">
                  <button
                    onClick={() => { setShowCreateMenu(false); setShowCreate(true); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                      <Layers size={15} className="text-teal" />
                    </div>
                    <div>
                      <div className="font-medium">Campaign</div>
                      <div className="text-xs text-faint">Multi-asset project with stages</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowCreateMenu(false); setShowAssetModal(true); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <FileCheck size={15} className="text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium">Asset</div>
                      <div className="text-xs text-faint">Quick single-item review</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowCreateMenu(false); setShowWebsiteModal(true); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-sm text-ink hover:bg-surface transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Globe size={15} className="text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium">Website</div>
                      <div className="text-xs text-faint">Website review with sitemap</div>
                    </div>
                  </button>
                </div>
              )}
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

        {showAssetModal && (
          <CreateStandaloneAssetModal
            companyId={companyId}
            userId={userId}
            onClose={() => setShowAssetModal(false)}
            onSuccess={fetchProjects}
          />
        )}

        {showWebsiteModal && (
          <CreateWebsiteProjectModal
            companyId={companyId}
            userId={userId}
            onClose={() => setShowWebsiteModal(false)}
            onSuccess={fetchProjects}
          />
        )}

        <WorkflowTemplatesManager
          companyId={companyId}
          open={showTemplates}
          onClose={() => setShowTemplates(false)}
        />

        {loading ? (
          <EntityListSkeleton viewMode={viewMode === 'board' ? 'grid' : viewMode} />
        ) : fetchError ? (
          <ErrorState
            description={fetchError}
            onRetry={() => { setLoading(true); fetchProjects(); }}
          />
        ) : filtered.length === 0 && (searchQuery || statusFilter || typeFilter || clientFilter) ? (
          <NoResults message={searchQuery ? `No projects matching “${searchQuery}”` : 'No projects match the selected filters'} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No campaigns yet"
            description="Campaigns let your clients review and approve creative assets — webpages, emails, ads, images, and more. Create one, upload your assets, then share the link."
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
            renderCard={(project) => <FeedbackBoardCard project={project} onRefresh={fetchProjects} customDomain={customDomain} />}
            onMove={(projectId, _from, to) => updateProjectStatus(projectId, to as FeedbackStatus)}
            emptyMessage="Drag a campaign into this column"
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

function FeedbackBoardCard({ project, onRefresh, customDomain }: { project: FeedbackProject; onRefresh: () => void; customDomain: string | null }) {
  const confirm = useConfirm();
  const toast = useToast();
  const updated = project.updated_at || project.created_at;
  const projectType = (project.project_type ?? 'campaign') as 'campaign' | 'asset' | 'website';
  const projectHref = projectType === 'asset' ? `/campaigns/${project.id}/review`
    : projectType === 'website' ? `/campaigns/${project.id}/sitemap`
    : `/campaigns/${project.id}/comments`;
  const [showMenu, setShowMenu] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ bottom: number; right: number } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description || '');
  const [editClientCompany, setEditClientCompany] = useState(project.client_company || '');
  const [editClientName, setEditClientName] = useState(project.client_name || '');
  const [editClientEmail, setEditClientEmail] = useState(project.client_email || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const openEditModal = () => {
    setEditTitle(project.title);
    setEditDescription(project.description || '');
    setEditClientCompany(project.client_company || '');
    setEditClientName(project.client_name || '');
    setEditClientEmail(project.client_email || '');
    setShowEdit(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('review_projects')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        client_company: editClientCompany.trim() || null,
        client_name: editClientName.trim() || null,
        client_email: editClientEmail.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);
    if (error) {
      toast.error(error.message || 'Could not save changes.');
    } else {
      toast.success('Project updated');
      setShowEdit(false);
      onRefresh();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setShowMenu(false);
    const ok = await confirm({
      title: 'Delete Campaign',
      message: `Delete "${project.title}"? This will remove all assets, comments, and versions permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('review_projects').delete().eq('id', project.id);
    toast.success('Project deleted');
    onRefresh();
  };

  const copyLink = () => {
    const url = buildReviewUrl(project.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  return (
    <>
      <div className="group relative bg-white rounded-2xl shadow-card-soft hover:shadow-card-hover p-3.5 transition-all">
        <div className="flex items-start gap-2.5">
          <div className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center ${
            projectType === 'asset' ? 'bg-amber-500/10' : projectType === 'website' ? 'bg-purple-500/10' : 'bg-teal/10'
          }`}>
            {projectType === 'asset' ? <FileCheck size={15} className="text-amber-600" />
              : projectType === 'website' ? <Globe size={15} className="text-purple-600" />
              : <MessageSquareText size={15} className="text-teal" />}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-caption font-medium text-ink truncate leading-tight">
              {project.title}
            </h4>
            <p className="text-detail text-faint mt-0.5 truncate">
              {project.client_company || project.client_name || (projectType === 'asset' ? 'Asset' : projectType === 'website' ? 'Website' : 'Campaign')}
            </p>
          </div>
          <button
            ref={menuBtnRef}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!showMenu && menuBtnRef.current) {
                const r = menuBtnRef.current.getBoundingClientRect();
                setMenuPos({ bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right });
              }
              setShowMenu(!showMenu);
            }}
            className="relative z-10 shrink-0 p-1 rounded-lg text-faint opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-surface transition-all"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
          <div className="flex items-center gap-1 text-detail text-dim">
            <Calendar size={11} />
            <span>{relativeShort(updated)}</span>
          </div>
          <Link
            href={projectHref}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 inline-flex items-center gap-1 text-detail font-medium text-teal hover:text-teal-hover"
          >
            <ExternalLink size={11} />
            Open
          </Link>
        </div>

        {showMenu && menuPos && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div
              className="fixed z-50 bg-white rounded-2xl border border-edge shadow-[0_4px_24px_rgba(20,20,40,0.08)] py-1 min-w-[140px]"
              style={{ bottom: menuPos.bottom, right: menuPos.right }}
            >
              <button
                onClick={openEditModal}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                {copied ? <Check size={14} className="text-[#2E7D32]" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <a
                href={`/review/${project.share_token}`}
                target="_blank"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                <ExternalLink size={14} />
                Preview
              </a>
              <div className="border-t border-edge my-1" />
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </>,
          document.body,
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Project" size="md">
        <Modal.Body className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Company / Brand Name</label>
            <input
              type="text"
              value={editClientCompany}
              onChange={(e) => setEditClientCompany(e.target.value)}
              placeholder="e.g. Premier Shipping Containers"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Contact Name</label>
              <input
                type="text"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Contact Email</label>
              <input
                type="email"
                value={editClientEmail}
                onChange={(e) => setEditClientEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!editTitle.trim() || saving}
            onClick={handleSaveEdit}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
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