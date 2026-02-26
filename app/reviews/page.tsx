// app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MessageSquareText } from 'lucide-react';
import { supabase, type ReviewProject } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import CreateReviewProjectModal from '@/components/admin/reviews/CreateReviewProjectModal';
import ReviewProjectCard from '@/components/admin/reviews/ReviewProjectCard';

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

  return (
    <div className="flex flex-col h-full">
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-8 pb-4 border-b border-gray-200 lg:border-b-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)]">
              Creative Review
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Share creative assets and collect visual feedback
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#017C87] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-[#017C87] text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-4 lg:pt-0">
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
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquareText size={28} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500 mb-1">
              {filter === 'active' ? 'No active review projects' : `No ${filter} projects`}
            </h3>
            <p className="text-sm text-gray-400">
              {filter === 'active'
                ? 'Create a project to start collecting feedback on your creative work'
                : 'Projects will appear here when their status changes'}
            </p>
            {filter === 'active' && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-[#017C87] text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors"
              >
                <Plus size={16} />
                New Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            {projects.map((project) => (
              <ReviewProjectCard
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