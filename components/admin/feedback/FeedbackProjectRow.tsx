'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Trash2, ExternalLink, MessageSquareText, CalendarDays,
  MoreHorizontal, Pencil, FileCheck, Globe,
} from 'lucide-react';
import type { ProjectType } from '@/lib/types/feedback';
import { Modal } from '@/components/ui/Modal';
import { supabase, type FeedbackProject, type FeedbackStatus } from '@/lib/supabase';
import { buildReviewUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import { REVIEW_STATUS_OPTIONS, getFeedbackStatusDef } from '@/lib/feedback/status';
import { Button } from '@/components/ui/Button';

interface ReviewProjectRowProps {
  project: FeedbackProject;
  onRefresh: () => void;
  customDomain?: string | null;
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

type ProjectStatus = FeedbackStatus;

const projectStatusOptions: StatusOption<ProjectStatus>[] = REVIEW_STATUS_OPTIONS.map((s) => ({
  value: s.value,
  label: s.label,
  bg: s.bg,
  text: s.text,
  border: s.border,
  icon: s.icon,
}));

export default function FeedbackProjectRow({ project, onRefresh, customDomain }: ReviewProjectRowProps) {
  const router = useRouter();
  const projectType: ProjectType = (project as FeedbackProject & { project_type?: ProjectType }).project_type ?? 'campaign';

  const projectHref = projectType === 'asset' ? `/campaigns/${project.id}/review`
    : projectType === 'website' ? `/campaigns/${project.id}/sitemap`
    : `/campaigns/${project.id}`;
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ bottom: number; right: number } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description || '');
  const [editClientCompany, setEditClientCompany] = useState(project.client_company || '');
  const [editClientName, setEditClientName] = useState(project.client_name || '');
  const [editClientEmail, setEditClientEmail] = useState(project.client_email || '');
  const [saving, setSaving] = useState(false);

  const fetchStats = useCallback(async () => {
    const { data: items } = await supabase
      .from('review_items')
      .select('id')
      .eq('review_project_id', project.id);

    if (items) {
      setItemCount(items.length);
      if (items.length > 0) {
        const { data: comments } = await supabase
          .from('review_comments')
          .select('resolved')
          .in('review_item_id', items.map(i => i.id))
          .is('parent_comment_id', null);
        if (comments) {
          setCommentCount(comments.length);
          setUnresolvedCount(comments.filter(c => !c.resolved).length);
        }
      }
    }
  }, [project.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildReviewUrl(project.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Campaign',
      message: `Delete "${project.title}"? This will remove all assets, comments, and versions permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('review_projects').delete().eq('id', project.id);
    toast.success('Project deleted');
    onRefresh();
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    const { error } = await supabase
      .from('review_projects')
      .update({ status: newStatus })
      .eq('id', project.id);

    if (error) {
      toast.error(error.message || 'Could not update status.');
    } else {
      const label = projectStatusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Project marked as ${label}`);
      onRefresh();
    }
  };

  const openEditModal = () => {
    setEditTitle(project.title);
    setEditDescription(project.description || '');
    setEditClientCompany(project.client_company || '');
    setEditClientName(project.client_name || '');
    setEditClientEmail(project.client_email || '');
    setShowEdit(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('review_projects')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        client_company: editClientCompany.trim() || null,
        client_name: editClientName.trim() || null,
        client_email: editClientEmail.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    if (error) {
      toast.error(error.message || 'Could not save changes.');
    } else {
      toast.success('Project updated');
      setShowEdit(false);
      onRefresh();
    }
    setSaving(false);
  };

  return (
    <>
      <div
        onClick={() => router.push(projectHref)}
        className="flex items-center gap-4 px-4 py-3 bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04)] hover:shadow-[0_2px_8px_rgba(20,20,40,0.06)] cursor-pointer transition-shadow group"
      >
        {/* Status dropdown */}
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <StatusDropdown
            value={project.status as ProjectStatus}
            options={projectStatusOptions}
            onChange={handleStatusChange}
          />
        </div>

        {/* Type badge */}
        {projectType !== 'campaign' && (
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold ${
            projectType === 'asset'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-purple-50 text-purple-700'
          }`}>
            {projectType === 'asset' ? <FileCheck size={10} /> : <Globe size={10} />}
            {projectType === 'asset' ? 'Asset' : 'Website'}
          </span>
        )}

        {/* Title + client */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
            {project.title}
          </h3>
          {(project.client_company || project.client_name || project.description) && (
            <p className="text-xs text-faint truncate">
              {project.client_company || project.client_name}
              {(project.client_company || project.client_name) && project.description && ' · '}
              {project.description}
            </p>
          )}
        </div>

        {/* Item count */}
        <span className="text-xs text-faint shrink-0 hidden sm:block w-16 text-right">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>

        {/* Comment count */}
        {commentCount > 0 && (
          <span className="text-xs shrink-0 hidden md:flex items-center gap-1 w-auto justify-end">
            <MessageSquareText size={11} className={unresolvedCount === 0 ? 'text-emerald-600' : 'text-faint'} />
            {unresolvedCount > 0 ? (
              <span className="flex items-center gap-1">
                <span className="text-amber-600 font-medium">{unresolvedCount} open</span>
                {commentCount - unresolvedCount > 0 && (
                  <>
                    <span className="text-faint">·</span>
                    <span className="text-emerald-600">{commentCount - unresolvedCount} resolved</span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">{commentCount} resolved</span>
            )}
          </span>
        )}

        {/* Due date */}
        {project.due_date ? (() => {
          const isOverdue = new Date(project.due_date + 'T23:59:59') < new Date();
          return (
            <span className={`shrink-0 hidden md:flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full ${
              isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
            }`}>
              <CalendarDays size={10} />
              {isOverdue ? 'Overdue' : formatDate(project.due_date)}
            </span>
          );
        })() : (
          <span className="text-xs text-faint shrink-0 hidden md:block w-16 text-right">
            {formatDate(project.created_at)}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={copyLink}
            className="p-1.5 rounded-lg text-faint hover:text-teal hover:bg-teal-tint transition-colors"
            title="Copy share link"
          >
            {copied ? <Check size={14} className="text-[#2E7D32]" /> : <Copy size={14} />}
          </button>

          <div className="relative">
            <button
              ref={menuBtnRef}
              onClick={() => {
                if (!showMenu && menuBtnRef.current) {
                  const r = menuBtnRef.current.getBoundingClientRect();
                  setMenuPos({ bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right });
                }
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && menuPos && createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div
                  className="fixed z-50 bg-white rounded-2xl border border-edge shadow-[0_4px_24px_rgba(20,20,40,0.08)] py-1 min-w-[140px]"
                  style={{ bottom: menuPos.bottom, right: menuPos.right }}
                >
                  <button
                    onClick={openEditModal}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <a
                    href={`/review/${project.share_token}`}
                    target="_blank"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface"
                  >
                    <ExternalLink size={14} />
                    Preview
                  </a>
                  <div className="border-t border-edge my-1" />
                  <button
                    onClick={() => { setShowMenu(false); handleDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </>,
              document.body,
            )}
          </div>
        </div>
      </div>

      {/* ─── Edit Modal ──────────────────────────────────────── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Project" size="md">
        <Modal.Body className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Company / Brand Name</label>
            <input
              type="text"
              value={editClientCompany}
              onChange={(e) => setEditClientCompany(e.target.value)}
              placeholder="e.g. Premier Shipping Containers"
              className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
            />
            <p className="text-xs text-faint mt-1.5">
              Used as the page name in Meta ad previews and the sender on email previews.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Contact Name</label>
              <input
                type="text"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Contact Email</label>
              <input
                type="email"
                value={editClientEmail}
                onChange={(e) => setEditClientEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface rounded-2xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 transition-colors"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={saving}
            disabled={!editTitle.trim() || saving}
            onClick={handleSaveEdit}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
