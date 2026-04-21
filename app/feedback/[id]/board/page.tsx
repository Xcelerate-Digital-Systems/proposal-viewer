'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import { buildReviewWhiteboardUrl } from '@/lib/proposal-url';
import AdminLayout from '@/components/admin/AdminLayout';
import { FeedbackBoard } from '@/components/admin/feedback/board';
import { useFeedbackBoardContext } from '@/components/admin/feedback/board/FeedbackBoardContext';
import ShareButton from '@/components/feedback/ShareButton';

export default function ReviewBoardPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <BoardGate isSuperAdmin={auth.isSuperAdmin} projectId={params.id} />
      )}
    </AdminLayout>
  );
}

function BoardGate({ isSuperAdmin, projectId }: { isSuperAdmin?: boolean; projectId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!isSuperAdmin) router.replace('/dashboard');
  }, [isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

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
    router.push(`/feedback/${projectId}/items/${itemId}${typeParam}`);
  };

  if (!project && !loading) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-gray-50 px-6 lg:px-10 pt-6 pb-0 border-b border-gray-200 lg:border-b-0">
        <Link
          href="/feedback"
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
                <ShareButton
                  token={project.board_share_token}
                  view="board"
                  projectId={project.id}
                  buildUrl={(t) => buildReviewWhiteboardUrl(t, customDomain, window.location.origin)}
                  label="Share Board"
                  onTokenChange={(t) => setProject((prev) => prev ? { ...prev, board_share_token: t } : prev)}
                />

                <button
                  onClick={openAddItem}
                  className="flex items-center gap-2 bg-teal text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-hover transition-colors"
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

      <div className="flex-1 px-2 pb-2 pt-2">
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
