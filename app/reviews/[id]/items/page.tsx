// app/reviews/[id]/items/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft, Copy, Check, Image } from 'lucide-react';
import ProjectTabs from '@/components/admin/reviews/ProjectTabs';
import { supabase, type ReviewProject, type ReviewItem, type ReviewShareMode } from '@/lib/supabase';
import { buildReviewProjectUrl } from '@/lib/proposal-url';
import AdminLayout from '@/components/admin/AdminLayout';
import AddReviewItemModal from '@/components/admin/reviews/AddReviewItemModal';
import ReviewItemCard from '@/components/admin/reviews/ReviewItemCard';
import TypeFilterTabs from '@/components/reviews/TypeFilterTabs';

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
/*  Status summary bar                                                 */
/* ------------------------------------------------------------------ */

interface StatusSummary {
  total: number;
  draft: number;
  in_review: number;
  approved: number;
  revision_needed: number;
}

function StatusBar({ summary }: { summary: StatusSummary }) {
  if (summary.total === 0) return null;

  const segments = [
    { count: summary.approved, color: 'bg-emerald-500', label: 'Approved' },
    { count: summary.in_review, color: 'bg-blue-400', label: 'In Review' },
    { count: summary.revision_needed, color: 'bg-amber-400', label: 'Revision Needed' },
    { count: summary.draft, color: 'bg-gray-300', label: 'Draft' },
  ].filter((s) => s.count > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Progress bar */}
      <div className="flex rounded-full overflow-hidden h-2 mb-3">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${(seg.count / summary.total) * 100}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${seg.color}`} />
            <span className="text-gray-500">
              {seg.count} {seg.label}
            </span>
          </div>
        ))}
        <span className="text-gray-400 ml-auto">
          {summary.total} item{summary.total !== 1 ? 's' : ''} total
        </span>
      </div>
    </div>
  );
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
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
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
      router.push('/reviews');
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

  const toggleShareMode = useCallback(async (mode: ReviewShareMode) => {
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

    // Connected webpage items → open the live URL directly
    if (item?.type === 'webpage' && item.widget_installed_at && item.url) {
      window.open(item.url, '_blank');
      return;
    }

    // Always scope the viewer to the clicked item's type so prev/next
    // navigation cycles through items of the same kind.
    const type = typeFilter || item?.type;
    const typeParam = type ? `?type=${type}` : '';
    router.push(`/reviews/${projectId}/items/${itemId}${typeParam}`);
  };

  // Compute status summary
  const statusSummary: StatusSummary = {
    total: items.length,
    draft: items.filter((i) => i.status === 'draft').length,
    in_review: items.filter((i) => i.status === 'in_review').length,
    approved: items.filter((i) => i.status === 'approved').length,
    revision_needed: items.filter((i) => i.status === 'revision_needed').length,
  };

  if (!project && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
        {/* Back link */}
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          All Projects
        </Link>

        {project && (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 font-[family-name:var(--font-display)] truncate">
                  {project.title}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  {project.client_name && (
                    <span className="text-sm text-gray-400">{project.client_name}</span>
                  )}
                  {project.description && (
                    <>
                      {project.client_name && <span className="text-gray-200">·</span>}
                      <span className="text-sm text-gray-400 truncate max-w-[300px]">
                        {project.description}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-2 bg-[#017C87] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
                >
                  <Plus size={16} />
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
          <AddReviewItemModal
            reviewProjectId={project.id}
            companyId={companyId}
            userId={userId}
            nextSortOrder={items.length}
            onClose={() => setShowAddItem(false)}
            onSuccess={(newItemId) => {
              fetchItems();
              if (newItemId) {
                router.push(`/reviews/${projectId}/items/${newItemId}`);
              }
            }}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
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
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#017C87] text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors"
            >
              <Plus size={16} />
              Add First Item
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Status summary */}
            <StatusBar summary={statusSummary} />

            {/* Type filter tabs */}
            <TypeFilterTabs
              items={items}
              availableTypes={availableTypes}
              typeFilter={typeFilter}
              onFilterChange={setTypeFilter}
            />

            {/* Items grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <ReviewItemCard
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