'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import AdminLayout from '@/components/admin/AdminLayout';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import KanbanBoard from '@/components/admin/feedback/kanban/KanbanBoard';
import { supabase, type FeedbackProject, type FeedbackItem } from '@/lib/supabase';

export default function FeedbackKanbanPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <KanbanGate
          isSuperAdmin={auth.isSuperAdmin}
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function KanbanGate({ isSuperAdmin, projectId, companyId, userId }: {
  isSuperAdmin?: boolean; projectId: string; companyId: string; userId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return <KanbanContent projectId={projectId} companyId={companyId} userId={userId} />;
}

function KanbanContent({
  projectId, companyId, userId,
}: {
  projectId: string; companyId: string; userId: string | null;
}) {
  const router = useRouter();
  const [project, setProject] = useState<FeedbackProject | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, { total: number; unresolved: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);

  const fetchProject = useCallback(async () => {
    const { data } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();
    if (!data) { router.push('/feedback'); return; }
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

  // Aggregate comment counts per item so KanbanCard can show the badge without
  // each card triggering its own network request.
  const fetchCommentCounts = useCallback(async () => {
    const { data } = await supabase
      .from('review_comments')
      .select('review_item_id, resolved')
      .is('parent_comment_id', null);
    if (!data) return;
    const counts: Record<string, { total: number; unresolved: number }> = {};
    for (const row of data) {
      const id = (row as { review_item_id: string }).review_item_id;
      const resolved = (row as { resolved: boolean }).resolved;
      if (!counts[id]) counts[id] = { total: 0, unresolved: 0 };
      counts[id].total += 1;
      if (!resolved) counts[id].unresolved += 1;
    }
    setCommentCounts(counts);
  }, []);

  useEffect(() => {
    fetchProject();
    fetchItems();
    fetchCommentCounts();
  }, [fetchProject, fetchItems, fetchCommentCounts]);

  const handleOpen = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.type === 'webpage' && item.url) {
      window.open(item.url, '_blank');
      return;
    }
    router.push(`/feedback/${projectId}/items/${itemId}`);
  }, [items, projectId, router]);

  const hasWebpages = useMemo(() => items.some((i) => i.type === 'webpage'), [items]);

  if (!project && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-4 border-b border-gray-200 lg:border-b-0">
        {project && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <Link href="/feedback" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0" title="All Projects">
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
            <ProjectTabs projectId={projectId} activeTab="kanban" hasWebpages={hasWebpages} />
          </>
        )}
      </div>

      <div className="flex-1 px-6 lg:px-10 pt-4 pb-8 overflow-hidden">
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
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No items yet</h3>
            <p className="text-sm text-gray-400 mb-4">
              Add items to organise them across the pipeline.
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
          <KanbanBoard
            items={items}
            commentCounts={commentCounts}
            onOpen={handleOpen}
            onItemsChange={setItems}
          />
        )}
      </div>
    </div>
  );
}
