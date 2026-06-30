'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import AdminLayout from '@/components/admin/AdminLayout';
import AddFeedbackItemModal from '@/components/admin/feedback/AddFeedbackItemModal';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';
import KanbanBoard from '@/components/admin/feedback/kanban/KanbanBoard';
import { supabase, type FeedbackProject, type FeedbackItem } from '@/lib/supabase';

export default function FeedbackKanbanPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout>
      {(auth) => (
        <KanbanGate
          accountType={auth.accountType}
          projectId={params.id}
          companyId={auth.companyId!}
          userId={auth.session?.user?.id ?? null}
        />
      )}
    </AdminLayout>
  );
}

function KanbanGate({ accountType, projectId, companyId, userId }: {
  accountType?: 'agency' | 'client'; projectId: string; companyId: string; userId: string | null;
}) {
  const router = useRouter();
  const allowed = accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;

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
  const [customDomain, setCustomDomain] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    const { data } = await supabase
      .from('review_projects')
      .select('*')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();
    if (!data) { router.push('/campaigns'); return; }
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
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) { setCommentCounts({}); return; }
    const { data } = await supabase
      .from('review_comments')
      .select('review_item_id, resolved')
      .in('review_item_id', itemIds)
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
  }, [items]);

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
    fetchCommentCounts();
    fetchCustomDomain();
  }, [fetchProject, fetchItems, fetchCommentCounts, fetchCustomDomain]);

  const handleOpen = useCallback((itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.type === 'webpage' && item.url) {
      window.open(item.url, '_blank');
      return;
    }
    router.push(`/campaigns/${projectId}/assets/${itemId}`);
  }, [items, projectId, router]);

  const hasWebpages = useMemo(() => items.some((i) => i.type === 'webpage'), [items]);

  if (!project && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      {project && (
        <FeedbackProjectHeader
          projectId={projectId}
          project={project}
          setProject={setProject}
          customDomain={customDomain}
          hasWebpages={hasWebpages}
          activeTab="kanban"
          onAddItem={() => setShowAddItem(true)}
        />
      )}

      <div className="flex-1 px-6 lg:px-10 pt-4 pb-8 overflow-hidden">
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
            <div className="w-6 h-6 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-semibold text-dim mb-1">No assets yet</h3>
            <p className="text-sm text-faint mb-4">
              Add assets to organise them across the pipeline.
            </p>
            <Button
              leftIcon={Plus}
              onClick={() => setShowAddItem(true)}
            >
              Add First Item
            </Button>
          </div>
        ) : (
          <KanbanBoard
            items={items}
            commentCounts={commentCounts}
            onOpen={handleOpen}
            onItemsChange={setItems}
            projectId={projectId}
            companyId={companyId}
          />
        )}
      </div>
    </div>
  );
}
