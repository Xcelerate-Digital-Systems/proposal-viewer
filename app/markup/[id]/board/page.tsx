'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { FeedbackBoard } from '@/components/admin/feedback/board';
import { useFeedbackBoardContext } from '@/components/admin/feedback/board/FeedbackBoardContext';
import FeedbackProjectHeader from '@/components/admin/feedback/FeedbackProjectHeader';

export default function ReviewBoardPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <AdminLayout collapseSidebar>
      {(auth) => (
        <BoardGate accountType={auth.accountType} projectId={params.id} />
      )}
    </AdminLayout>
  );
}

function BoardGate({ accountType, projectId }: { accountType?: 'agency' | 'client'; projectId: string }) {
  const router = useRouter();
  const allowed = accountType === 'agency';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) return null;

  return <BoardContent projectId={projectId} />;
}

function BoardContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ctx = useFeedbackBoardContext();

  if (!ctx) return null;
  const { project, items, loading, customDomain, setProject, openAddItem } = ctx;

  const handleOpenViewer = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.type === 'webpage' && item.url) {
      window.open(item.url, '_blank');
      return;
    }
    const typeParam = item ? `?type=${item.type}` : '';
    router.push(`/markup/${projectId}/items/${itemId}${typeParam}`);
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
          activeTab="board"
          onAddItem={openAddItem}
        />
      )}

      <div className="flex-1 min-h-0 px-2 pb-2 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <FeedbackBoard onNavigateToItem={handleOpenViewer} />
        )}
      </div>
    </div>
  );
}
