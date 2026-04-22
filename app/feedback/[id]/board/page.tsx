'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, Pause, Play } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import { buildReviewWhiteboardUrl } from '@/lib/proposal-url';
import AdminLayout from '@/components/admin/AdminLayout';
import { FeedbackBoard } from '@/components/admin/feedback/board';
import { useFeedbackBoardContext } from '@/components/admin/feedback/board/FeedbackBoardContext';
import ShareButton from '@/components/feedback/ShareButton';
import ReviewerNoteModal from '@/components/admin/feedback/ReviewerNoteModal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

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
  const toast = useToast();
  const ctx = useFeedbackBoardContext();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);

  if (!ctx) return null;
  const { project, items, loading, customDomain, setProject, openAddItem } = ctx;

  const togglePauseComments = async () => {
    if (!project || togglingPause) return;
    const next = !project.pause_new_comments;
    setTogglingPause(true);
    const { error } = await supabase
      .from('review_projects')
      .update({ pause_new_comments: next, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setTogglingPause(false);
    if (error) {
      toast.error('Failed to update');
      return;
    }
    setProject((prev) => prev ? { ...prev, pause_new_comments: next } : prev);
    toast.success(next ? 'New comments paused' : 'Comments reopened');
  };

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
                  onClick={togglePauseComments}
                  disabled={togglingPause}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors disabled:opacity-50 ${
                    project.pause_new_comments
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  title={project.pause_new_comments ? 'Reopen comments for reviewers' : 'Pause new reviewer comments'}
                >
                  {project.pause_new_comments ? <Play size={14} /> : <Pause size={14} />}
                  {project.pause_new_comments ? 'Comments paused' : 'Pause'}
                </button>

                <button
                  onClick={() => setShowNoteModal(true)}
                  className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                  title={project.reviewer_note ? 'Edit reviewer note' : 'Add a note for reviewers'}
                >
                  <FileText size={14} />
                  Note
                  {project.reviewer_note && project.reviewer_note_show && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-teal"
                      aria-label="Note visible to reviewers"
                    />
                  )}
                </button>

                <ShareButton
                  token={project.board_share_token}
                  view="board"
                  projectId={project.id}
                  buildUrl={(t) => buildReviewWhiteboardUrl(t, customDomain, window.location.origin)}
                  label={project.board_share_token ? 'Copy link' : 'Share Board'}
                  permanent
                  onTokenChange={(t) => setProject((prev) => prev ? { ...prev, board_share_token: t } : prev)}
                />

                <button
                  onClick={openAddItem}
                  className="flex items-center gap-2 bg-teal text-white px-3.5 py-2 rounded-lg text-[13px] font-medium hover:bg-teal-hover transition-colors"
                >
                  <Plus size={15} />
                  Add Item
                </button>
              </div>
            </div>
            <ProjectTabs projectId={projectId} activeTab="board" hasWebpages={items.some((i) => i.type === 'webpage')} />
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 px-2 pb-2 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
          </div>
        ) : (
          <FeedbackBoard onNavigateToItem={handleOpenViewer} />
        )}
      </div>

      {showNoteModal && project && (
        <ReviewerNoteModal
          projectId={project.id}
          initialNote={project.reviewer_note ?? ''}
          initialShow={project.reviewer_note_show}
          onClose={() => setShowNoteModal(false)}
          onSaved={(next) => setProject((prev) => prev ? { ...prev, ...next } : prev)}
        />
      )}
    </div>
  );
}
