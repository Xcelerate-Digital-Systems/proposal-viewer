// app/reviews/[id]/board/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import ProjectTabs from '@/components/admin/reviews/ProjectTabs';
import { supabase, type ReviewProject, type ReviewItem } from '@/lib/supabase';
import { buildReviewWhiteboardUrl } from '@/lib/proposal-url';
import AdminLayout from '@/components/admin/AdminLayout';
import AddReviewItemModal from '@/components/admin/reviews/AddReviewItemModal';
import { ReviewBoard } from '@/components/admin/reviews/board';
import ShareButton from '@/components/reviews/ShareButton';

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export default function ReviewBoardPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <BoardGate
          isSuperAdmin={auth.isSuperAdmin}
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function BoardGate({ isSuperAdmin, projectId, companyId, userId }: {
  isSuperAdmin?: boolean; projectId: string; companyId: string; userId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return <BoardContent projectId={projectId} companyId={companyId} userId={userId} />;
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function BoardContent({
  projectId,
  companyId,
  userId,
}: {
  projectId: string;
  companyId: string;
  userId: string | null;
}) {
  const router = useRouter();
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);

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

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchCustomDomain();
  }, [fetchProject, fetchItems, fetchCustomDomain]);

  const handleOpenViewer = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);

    // Connected webpage items → open the live URL directly
    if (item?.type === 'webpage' && item.widget_installed_at && item.url) {
      window.open(item.url, '_blank');
      return;
    }

    const typeParam = item ? `?type=${item.type}` : '';
    router.push(`/reviews/${projectId}/items/${itemId}${typeParam}`);
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
                {/* Share board — generates board_share_token, copies /whiteboard/[token] */}
                <ShareButton
                  token={project.board_share_token}
                  view="board"
                  projectId={project.id}
                  buildUrl={(t) => buildReviewWhiteboardUrl(t, customDomain, window.location.origin)}
                  label="Share Board"
                  onTokenChange={(t) => setProject((prev) => prev ? { ...prev, board_share_token: t } : prev)}
                />

                <button
                  onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-2 bg-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors"
                >
                  <Plus size={16} />
                  Add Item
                </button>
              </div>
            </div>
            <ProjectTabs projectId={projectId} activeTab="board" hasWebpages={items.some((i) => i.type === 'webpage')} />
          </>
        )}
      </div>

      {/* Board content */}
      <div className="flex-1 px-2 pb-2 pt-2">
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
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <ReviewBoard
            projectId={projectId}
            companyId={companyId}
            items={items}
            onRefreshItems={fetchItems}
            onNavigateToItem={handleOpenViewer}
          />
        )}
      </div>
    </div>
  );
}