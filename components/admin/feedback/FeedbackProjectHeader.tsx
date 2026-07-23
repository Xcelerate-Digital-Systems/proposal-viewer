'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, Pause, Play, CalendarDays, PackageCheck, Link2, Unlink, AlertTriangle } from 'lucide-react';
import ProjectTabs from '@/components/admin/feedback/ProjectTabs';
import ReviewerNoteModal from '@/components/admin/feedback/ReviewerNoteModal';
import ShareMenu from '@/components/feedback/ShareMenu';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import { buildReviewProjectUrl } from '@/lib/proposal-url';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { DEFAULT_SHARED_VIEWS, type FeedbackStatus } from '@/lib/types/feedback';
import { REVIEW_STATUS_OPTIONS } from '@/lib/feedback/status';
import { hasOverdueStage } from '@/lib/feedback/stage-due-dates';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/auth-fetch';

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
  activeTab: 'board' | 'kanban' | 'assets' | 'comments' | 'setup' | 'settings';
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
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [showHandoffMenu, setShowHandoffMenu] = useState(false);

  const isHandoffReady = project.status === 'approved' || project.status === 'archived';
  const hasHandoffLink = !!project.handoff_share_token;

  const generateHandoff = async () => {
    setHandoffLoading(true);
    try {
      const res = await authFetch(`/api/campaigns/${project.id}/handoff`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to generate handoff link');
        return;
      }
      const { token } = await res.json();
      setProject((prev) => (prev ? { ...prev, handoff_share_token: token } : prev));
      const url = `${window.location.origin}/handoff/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Handoff link copied to clipboard');
    } catch {
      toast.error('Failed to generate handoff link');
    } finally {
      setHandoffLoading(false);
    }
  };

  const copyHandoffLink = async () => {
    if (!project.handoff_share_token) return;
    const url = `${window.location.origin}/handoff/${project.handoff_share_token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Handoff link copied');
  };

  const revokeHandoff = async () => {
    try {
      const res = await authFetch(`/api/campaigns/${project.id}/handoff`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to revoke handoff link');
        return;
      }
      setProject((prev) => (prev ? { ...prev, handoff_share_token: null } : prev));
      toast.success('Handoff link revoked');
      setShowHandoffMenu(false);
    } catch {
      toast.error('Failed to revoke handoff link');
    }
  };

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
              {project.stage_due_dates && hasOverdueStage(project.stage_due_dates) && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-2xs font-medium bg-red-50 text-red-600">
                  <AlertTriangle size={10} />
                  Stage overdue
                </span>
              )}
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
            hasPassword={!!project.share_password_hash}
            expiresAt={project.share_expires_at}
            onSecurityChange={({ hasPassword, expiresAt: ea }) =>
              setProject((prev) => (prev ? {
                ...prev,
                share_password_hash: hasPassword ? (prev.share_password_hash || 'set') : null,
                share_expires_at: ea,
              } : prev))
            }
          />

          {isHandoffReady && (
            <div className="relative">
              {hasHandoffLink ? (
                <button
                  onClick={() => setShowHandoffMenu(!showHandoffMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <PackageCheck size={14} />
                  Handoff
                </button>
              ) : (
                <button
                  onClick={generateHandoff}
                  disabled={handoffLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-surface text-prose hover:bg-surface transition-colors disabled:opacity-50"
                >
                  <PackageCheck size={14} />
                  {handoffLoading ? 'Generating…' : 'Handoff'}
                </button>
              )}

              {showHandoffMenu && hasHandoffLink && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHandoffMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-edge bg-white shadow-lg py-1.5">
                    <button
                      onClick={() => { copyHandoffLink(); setShowHandoffMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-sm text-prose hover:bg-paper transition-colors"
                    >
                      <Link2 size={14} className="text-muted" />
                      Copy handoff link
                    </button>
                    <button
                      onClick={() => {
                        window.open(`/handoff/${project.handoff_share_token}`, '_blank');
                        setShowHandoffMenu(false);
                      }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-sm text-prose hover:bg-paper transition-colors"
                    >
                      <PackageCheck size={14} className="text-muted" />
                      Open handoff page
                    </button>
                    <div className="my-1 border-t border-edge" />
                    <button
                      onClick={revokeHandoff}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Unlink size={14} />
                      Revoke link
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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
