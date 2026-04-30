'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, Pause, Play } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import ReviewerNoteModal from '@/components/admin/feedback/ReviewerNoteModal';
import ShareButton from '@/components/feedback/ShareButton';
import { buildReviewProjectUrl, buildReviewWhiteboardUrl } from '@/lib/proposal-url';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface Props {
  projectId: string;
  project: FeedbackProject;
  setProject: (updater: (prev: FeedbackProject | null) => FeedbackProject | null) => void;
  customDomain: string | null;
  hasWebpages: boolean;
  activeTab: 'board' | 'kanban' | 'items' | 'feedback';
  /** Which share scope this tab links to. Board tab → board view; the rest → items view. */
  shareView?: 'board' | 'items';
  onAddItem?: () => void;
}

export default function FeedbackProjectHeader({
  projectId,
  project,
  setProject,
  customDomain,
  hasWebpages,
  activeTab,
  shareView,
  onAddItem,
}: Props) {
  const toast = useToast();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);

  const view = shareView ?? (activeTab === 'board' ? 'board' : 'items');
  const token = view === 'board' ? project.board_share_token : project.share_token;
  const buildUrl = view === 'board'
    ? (t: string) => buildReviewWhiteboardUrl(t, customDomain, window.location.origin)
    : (t: string) => buildReviewProjectUrl(t, customDomain, window.location.origin);

  const togglePauseComments = async () => {
    if (togglingPause) return;
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
    setProject((prev) => (prev ? { ...prev, pause_new_comments: next } : prev));
    toast.success(next ? 'New comments paused' : 'Comments reopened');
  };

  return (
    <div className="sticky top-0 z-10 bg-white px-6 lg:px-10 pt-5">
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
            <h1 className="text-[17px] font-semibold tracking-tight text-ink font-[family-name:var(--font-display)] truncate">
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors disabled:opacity-50 ${
              project.pause_new_comments
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200/70'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            title={project.pause_new_comments ? 'Reopen comments for reviewers' : 'Pause new reviewer comments'}
          >
            {project.pause_new_comments ? <Play size={14} /> : <Pause size={14} />}
            {project.pause_new_comments ? 'Comments paused' : 'Pause'}
          </button>

          <button
            onClick={() => setShowNoteModal(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
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
            token={token}
            view={view}
            projectId={project.id}
            buildUrl={buildUrl}
            label={token ? 'Copy link' : 'Share'}
            permanent
            onTokenChange={(t) =>
              setProject((prev) => {
                if (!prev) return prev;
                return view === 'board'
                  ? { ...prev, board_share_token: t }
                  : { ...prev, share_token: t ?? prev.share_token };
              })
            }
          />

          {onAddItem && (
            <button
              onClick={onAddItem}
              className="flex items-center gap-2 bg-teal text-white px-4 py-1.5 rounded-full text-[13px] font-semibold hover:bg-teal-hover transition-colors shadow-sm"
            >
              <Plus size={15} />
              Add Item
            </button>
          )}
        </div>
      </div>

      <ProjectTabs projectId={projectId} activeTab={activeTab} hasWebpages={hasWebpages} />

      {showNoteModal && (
        <ReviewerNoteModal
          projectId={project.id}
          initialNote={project.reviewer_note ?? ''}
          initialShow={project.reviewer_note_show}
          onClose={() => setShowNoteModal(false)}
          onSaved={(next) => setProject((prev) => (prev ? { ...prev, ...next } : prev))}
        />
      )}
    </div>
  );
}
