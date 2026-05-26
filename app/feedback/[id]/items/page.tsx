'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Image } from 'lucide-react';
import { supabase, type FeedbackProject, type FeedbackItem } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import FeedbackItemCard from '@/components/admin/feedback/FeedbackItemCard';
import TypeFilterTabs from '@/components/feedback/TypeFilterTabs';
/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function ReviewItemsPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }
) {
  const searchParams = use(props.searchParams);
  const params = use(props.params);
  return (
    <AdminLayout>
      {(auth) => (
        <ItemsGate
          accountType={auth.accountType}
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
          initialTypeFilter={searchParams.type || null}
        />
      )}
    </AdminLayout>
  );
}

function ItemsGate({ accountType, projectId, companyId, userId, initialTypeFilter }: {
  accountType?: 'agency' | 'client'; projectId: string; companyId: string; userId: string | null; initialTypeFilter: string | null;
}) {
  const router = useRouter();
  const allowed = accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;

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

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchCustomDomain();
  }, [fetchProject, fetchItems, fetchCustomDomain]);

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
      {project && (
        <FeedbackProjectHeader
          projectId={projectId}
          project={project}
          setProject={setProject}
          customDomain={customDomain}
          hasWebpages={items.some((i) => i.type === 'webpage')}
          activeTab="items"
          onAddItem={() => setShowAddItem(true)}
        />
      )}

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
            onSuccess={() => {
              fetchItems();
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