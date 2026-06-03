'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, Pause, Play, CalendarDays } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import ReviewerNoteModal from '@/components/admin/feedback/ReviewerNoteModal';
import ShareMenu from '@/components/feedback/ShareMenu';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import { buildReviewProjectUrl } from '@/lib/proposal-url';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { DEFAULT_SHARED_VIEWS, type FeedbackStatus } from '@/lib/types/feedback';
import { REVIEW_STATUS_OPTIONS } from '@/lib/feedback/status';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

const projectStatusOptions: StatusOption<FeedbackStatus>[] = REVIEW_STATUS_OPTIONS.map((s) => ({
  value: s.value,
  label: s.label,
  bg: s.bg,
  text: s.text,
  border: s.border,
  icon: s.icon,
}));

interface Props {
  projectId: string;
  project: FeedbackProject;
  setProject: (updater: (prev: FeedbackProject | null) => FeedbackProject | null) => void;
  customDomain: string | null;
  hasWebpages: boolean;
  activeTab: 'board' | 'kanban' | 'assets' | 'comments';
  onAddItem?: () => void;
}

export default function FeedbackProjectHeader({
  projectId,
  project,
  setProject,
  customDomain,
  hasWebpages,
  activeTab,
  onAddItem,
}: Props) {
  const toast = useToast();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);

  const buildUrl = (t: string) => buildReviewProjectUrl(t, customDomain, window.location.origin);

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    const { error } = await supabase
      .from('review_projects')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    if (error) {
      toast.error('Failed to update status');
      return;
    }
    const label = projectStatusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
    toast.success(`Project marked as ${label}`);
    setProject((prev) => (prev ? { ...prev, status: newStatus } : prev));
  };

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
            href="/campaigns"
            className="text-faint hover:text-prose transition-colors shrink-0"
            title="All Campaigns"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[17px] font-semibold tracking-tight text-ink font-[family-name:var(--font-display)] truncate">
                {project.title}
              </h1>
              <StatusDropdown
                value={project.status}
                options={projectStatusOptions}
                onChange={handleStatusChange}
                variant="compact"
                fullWidth={false}
              />
            </div>
            <p className="text-xs text-faint truncate flex items-center gap-1.5">
              <span>
                {project.client_company || project.client_name}
                {(project.client_company || project.client_name) && project.description && ' · '}
                {project.description}
              </span>
              {project.due_date && (() => {
                const isOverdue = new Date(project.due_date + 'T23:59:59') < new Date();
                const label = new Date(project.due_date + 'T00:00:00').toLocaleDateString('en-AU', {
                  day: 'numeric', month: 'short',
                });
                return (
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs font-medium ${
                    isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                  }`}>
                    <CalendarDays size={10} />
                    {isOverdue ? 'Overdue' : `Due ${label}`}
                  </span>
                );
              })()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={togglePauseComments}
            disabled={togglingPause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium transition-colors disabled:opacity-50 ${
              project.pause_new_comments
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200/70'
                : 'bg-surface text-prose hover:bg-surface'
            }`}
            title={project.pause_new_comments ? 'Reopen comments for reviewers' : 'Pause new reviewer comments'}
          >
            {project.pause_new_comments ? <Play size={14} /> : <Pause size={14} />}
            {project.pause_new_comments ? 'Comments paused' : 'Pause'}
          </button>

          <button
            onClick={() => setShowNoteModal(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-surface text-prose hover:bg-surface transition-colors"
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

          <ShareMenu
            projectId={project.id}
            shareToken={project.share_token}
            sharedViews={project.shared_views ?? DEFAULT_SHARED_VIEWS}
            buildUrl={buildUrl}
            onViewsChange={(next) =>
              setProject((prev) => (prev ? { ...prev, shared_views: next } : prev))
            }
          />

          {onAddItem && (
            <Button size="sm" leftIcon={Plus} onClick={onAddItem}>
              Add Asset
            </Button>
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
