// app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MessageSquareText, LayoutGrid, List, Search } from 'lucide-react';
import { supabase, type ReviewProject } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import CreateReviewProjectModal from '@/components/admin/reviews/CreateReviewProjectModal';
import ReviewProjectCard from '@/components/admin/reviews/ReviewProjectCard';
import ReviewProjectRow from '@/components/admin/reviews/ReviewProjectRow';

export default function ReviewsPage() {
  return (
    <AdminLayout>
      {(auth) => (
        <ReviewsGate
          isSuperAdmin={auth.isSuperAdmin}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function ReviewsGate({ isSuperAdmin, companyId, userId }: { isSuperAdmin?: boolean; companyId: string; userId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return <ReviewsContent companyId={companyId} userId={userId} />;
}

type FilterTab = 'active' | 'completed' | 'archived' | 'all';

function ReviewsContent({ companyId, userId }: { companyId: string; userId: string | null }) {
  const [projects, setProjects] = useState<ReviewProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agencyviz-reviews-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('agencyviz-reviews-view', mode);
  };

  const fetchProjects = useCallback(async () => {
    if (!companyId) return;
    let query = supabase
      .from('review_projects')
      .select('*')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    setProjects(data || []);
    setLoading(false);
  }, [companyId, filter]);

  const fetchCustomDomain = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    } else {
      setCustomDomain(null);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    fetchProjects();
    fetchCustomDomain();
  }, [fetchProjects, fetchCustomDomain]);

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
      <div className="border-b border-edge bg-ivory px-6 lg:px-10 py-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-ink">
              Creative Review
            </h1>
            <p className="text-sm text-muted mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-surface rounded-[10px] p-1 gap-0.5">
              <button
                onClick={() => toggleView('grid')}
                className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
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
                className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-surface rounded-[10px] px-3.5 py-2.5 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
              <Search size={16} className="text-faint shrink-0" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
              />
            </div>

            {/* New project */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showCreate && (
          <CreateReviewProjectModal
            companyId={companyId}
            userId={userId}
            onClose={() => setShowCreate(false)}
            onSuccess={fetchProjects}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 && searchQuery ? (
          <div className="text-center py-20">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No projects matching &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquareText size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-muted mb-1">
              {filter === 'active' ? 'No active review projects' : `No ${filter} projects`}
            </h3>
            <p className="text-sm text-faint">
              {filter === 'active'
                ? 'Create a project to start collecting feedback on your creative work'
                : 'Projects will appear here when their status changes'}
            </p>
            {filter === 'active' && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
              >
                <Plus size={16} />
                New Project
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((project) => (
              <ReviewProjectCard
                key={project.id}
                project={project}
                onRefresh={fetchProjects}
                customDomain={customDomain}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((project) => (
              <ReviewProjectRow
                key={project.id}
                project={project}
                onRefresh={fetchProjects}
                customDomain={customDomain}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}