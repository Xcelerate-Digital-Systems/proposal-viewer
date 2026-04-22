'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft, Copy, Check, Image } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import { supabase, type FeedbackProject, type FeedbackItem, type FeedbackShareMode } from '@/lib/supabase';
import { buildReviewProjectUrl } from '@/lib/proposal-url';
import AdminLayout from '@/components/admin/AdminLayout';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import FeedbackItemCard from '@/components/admin/feedback/FeedbackItemCard';
import TypeFilterTabs from '@/components/feedback/TypeFilterTabs';
/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function ReviewItemsPage({ params, searchParams }: { params: { id: string }; searchParams: { type?: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <ItemsGate
          isSuperAdmin={auth.isSuperAdmin}
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
          initialTypeFilter={searchParams.type || null}
        />
      )}
    </AdminLayout>
  );
}

function ItemsGate({ isSuperAdmin, projectId, companyId, userId, initialTypeFilter }: {
  isSuperAdmin?: boolean; projectId: string; companyId: string; userId: string | null; initialTypeFilter: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return <ItemsContent projectId={projectId} companyId={companyId} userId={userId} initialTypeFilter={initialTypeFilter} />;
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function ItemsContent({
  projectId,
  companyId,
  userId,
  initialTypeFilter,
}: {
  projectId: string;
  companyId: string;
  userId: string | null;
  initialTypeFilter: string | null;
}) {
  const router = useRouter();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(initialTypeFilter);

  // Unique types + filtered items
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(items.map((i) => i.type)));
    return types.sort();
  }, [items]);

  const filteredItems = useMemo(
    () => (typeFilter ? items.filter((i) => i.type === typeFilter) : items),
    [items, typeFilter]
  );

  const fetchProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/feedback');
      return;
    }
    setProject(data);
  }, [projectId, companyId, router]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('review_project_id', projectId)
      .order('sort_order', { ascending: true });

    setItems(data || []);
    setLoading(false);
  }, [projectId]);

  const fetchCustomDomain = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    }
  }, [companyId]);

  const toggleShareMode = useCallback(async (mode: FeedbackShareMode) => {
    if (!project) return;
    await supabase
      .from('review_projects')
      .update({ share_mode: mode, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setProject((prev) => prev ? { ...prev, share_mode: mode } : prev);
  }, [project]);

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchCustomDomain();
  }, [fetchProject, fetchItems, fetchCustomDomain]);

  const copyLink = () => {
    if (!project) return;
    const url = buildReviewProjectUrl(project.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenViewer = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);

    // Webpage items → feedback happens on the live page via the widget,
    // not inside the admin viewer, so always open the URL.
    if (item?.type === 'webpage' && item.url) {
      window.open(item.url, '_blank');
      return;
    }

    // Always scope the viewer to the clicked item's type so prev/next
    // navigation cycles through items of the same kind.
    const type = typeFilter || item?.type;
    const typeParam = type ? `?type=${type}` : '';
    router.push(`/feedback/${projectId}/items/${itemId}${typeParam}`);
  };

  if (!project && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header — compact (title + actions in one row, tabs below) */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-4 border-b border-gray-200 lg:border-b-0">
        {project && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <Link
                  href="/feedback"
                  className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  title="All Projects"
                >
                  <ArrowLeft size={16} />
                </Link>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
                    {project.title}
                  </h1>
                  <p className="text-xs text-gray-400 truncate">
                    {project.client_name}
                    {project.client_name && project.description && ' · '}
                    {project.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-2 bg-teal text-white px-3.5 py-2 rounded-lg text-[13px] font-medium hover:bg-teal-hover transition-colors"
                >
                  <Plus size={15} />
                  Add Item
                </button>
              </div>
            </div>
            <ProjectTabs projectId={projectId} activeTab="items" hasWebpages={items.some((i) => i.type === 'webpage')} />
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 lg:px-10 pb-8 pt-4 lg:pt-0">
        {/* Add Item Modal */}
        {showAddItem && project && (
          <AddFeedbackItemModal
            reviewProjectId={project.id}
            companyId={companyId}
            userId={userId}
            nextSortOrder={items.length}
            onClose={() => setShowAddItem(false)}
            onSuccess={(created) => {
              fetchItems();
              if (!created) return;
              // Webpages: feedback happens on the live page, not the viewer
              if (created.type === 'webpage' && created.url) {
                window.open(created.url, '_blank');
                return;
              }
              router.push(`/feedback/${projectId}/items/${created.id}`);
            }}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Image size={28} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No items yet</h3>
            <p className="text-sm text-gray-400 mb-4">
              Add images, web pages, or ad creatives to start collecting feedback
            </p>
            <button
              onClick={() => setShowAddItem(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-hover transition-colors"
            >
              <Plus size={16} />
              Add First Item
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Type filter tabs */}
            <TypeFilterTabs
              items={items}
              availableTypes={availableTypes}
              typeFilter={typeFilter}
              onFilterChange={setTypeFilter}
            />

            {/* Items grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredItems.map((item) => (
                <FeedbackItemCard
                  key={item.id}
                  item={item}
                  onRefresh={fetchItems}
                  onOpenViewer={handleOpenViewer}
                  customDomain={customDomain}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}