// components/admin/reviews/ReviewProjectCard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Trash2, ExternalLink, MessageSquareText,
  Image, CheckCircle2, AlertCircle, MoreHorizontal, Pencil,
  Eye, FolderOpen,
} from 'lucide-react';
import { supabase, type ReviewProject } from '@/lib/supabase';
import { buildReviewUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';

interface ReviewProjectCardProps {
  project: ReviewProject;
  onRefresh: () => void;
  customDomain?: string | null;
}

type ItemStats = {
  total: number;
  approved: number;
  revision_needed: number;
  in_review: number;
  draft: number;
};

type CommentStats = {
  total: number;
  resolved: number;
  unresolved: number;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

type ProjectStatus = 'active' | 'completed' | 'archived';

const projectStatusOptions: StatusOption<ProjectStatus>[] = [
  {
    value: 'active',
    label: 'Active',
    bg: 'bg-[#E8F5E9]',
    text: 'text-[#2E7D32]',
    border: 'border-[#C8E6C9]',
    icon: <CheckCircle2 size={12} />,
  },
  {
    value: 'completed',
    label: 'Completed',
    bg: 'bg-teal-tint',
    text: 'text-teal',
    border: 'border-[#B2DFDB]',
    icon: <Check size={12} />,
  },
  {
    value: 'archived',
    label: 'Archived',
    bg: 'bg-surface',
    text: 'text-muted',
    border: 'border-edge',
    icon: <AlertCircle size={12} />,
  },
];

export default function ReviewProjectCard({ project, onRefresh, customDomain }: ReviewProjectCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description || '');
  const [editClientName, setEditClientName] = useState(project.client_name || '');
  const [editClientEmail, setEditClientEmail] = useState(project.client_email || '');
  const [saving, setSaving] = useState(false);
  const [itemStats, setItemStats] = useState<ItemStats>({ total: 0, approved: 0, revision_needed: 0, in_review: 0, draft: 0 });
  const [commentStats, setCommentStats] = useState<CommentStats>({ total: 0, resolved: 0, unresolved: 0 });

  const fetchStats = useCallback(async () => {
    const { data: items } = await supabase
      .from('review_items')
      .select('id, status')
      .eq('review_project_id', project.id);

    if (items) {
      setItemStats({
        total: items.length,
        approved: items.filter(i => i.status === 'approved').length,
        revision_needed: items.filter(i => i.status === 'revision_needed').length,
        in_review: items.filter(i => i.status === 'in_review').length,
        draft: items.filter(i => i.status === 'draft').length,
      });

      if (items.length > 0) {
        const itemIds = items.map(i => i.id);
        const { data: comments } = await supabase
          .from('review_comments')
          .select('resolved')
          .in('review_item_id', itemIds)
          .is('parent_comment_id', null);

        if (comments) {
          setCommentStats({
            total: comments.length,
            resolved: comments.filter(c => c.resolved).length,
            unresolved: comments.filter(c => !c.resolved).length,
          });
        }
      }
    }
  }, [project.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const copyLink = () => {
    const url = buildReviewUrl(project.share_token, customDomain, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Review Project',
      message: `Delete "${project.title}"? This will remove all items, comments, and versions permanently.`,
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
      toast.error('Failed to update status');
    } else {
      const label = projectStatusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Project marked as ${label}`);
      onRefresh();
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('review_projects')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        client_name: editClientName.trim() || null,
        client_email: editClientEmail.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    if (error) {
      toast.error('Failed to save changes');
    } else {
      toast.success('Project updated');
      setShowEdit(false);
      onRefresh();
    }
    setSaving(false);
  };

  const openEditModal = () => {
    setEditTitle(project.title);
    setEditDescription(project.description || '');
    setEditClientName(project.client_name || '');
    setEditClientEmail(project.client_email || '');
    setShowEdit(true);
    setShowMenu(false);
  };

  // Build progress segments
  const progressSegments = [
    { count: itemStats.approved, color: 'bg-emerald-500' },
    { count: itemStats.in_review, color: 'bg-blue-400' },
    { count: itemStats.revision_needed, color: 'bg-amber-400' },
    { count: itemStats.draft, color: 'bg-gray-300' },
  ].filter((s) => s.count > 0);

  return (
    <>
      <div className="bg-white rounded-[14px] border border-edge hover:border-edge-hover transition-colors flex flex-col">
        {/* ─── Visual header — click to open ──────────────────── */}
        <button
          onClick={() => router.push(`/reviews/${project.id}`)}
          className="w-full aspect-[4/3] rounded-t-[14px] overflow-hidden cursor-pointer hover:opacity-95 transition-opacity relative bg-surface flex flex-col items-center justify-center p-5 border-b border-edge"
        >
          {itemStats.total > 0 ? (
            <div className="w-full flex flex-col items-center gap-3">
              {/* Large item count */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-ink">{itemStats.total}</span>
                <span className="text-sm text-faint font-medium">item{itemStats.total !== 1 ? 's' : ''}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-[80%] flex rounded-full overflow-hidden h-2">
                {progressSegments.map((seg, i) => (
                  <div
                    key={i}
                    className={`${seg.color}`}
                    style={{ width: `${(seg.count / itemStats.total) * 100}%` }}
                  />
                ))}
              </div>

              {/* Mini legend */}
              <div className="flex items-center gap-3 flex-wrap justify-center">
                {itemStats.approved > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-[#2E7D32] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {itemStats.approved} approved
                  </span>
                )}
                {itemStats.in_review > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-teal font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                    {itemStats.in_review} in review
                  </span>
                )}
                {itemStats.revision_needed > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {itemStats.revision_needed} revision
                  </span>
                )}
                {itemStats.draft > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-faint font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-edge-hover" />
                    {itemStats.draft} draft
                  </span>
                )}
              </div>

              {/* Comment count */}
              {commentStats.total > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-faint mt-1">
                  <MessageSquareText size={11} />
                  <span>
                    {commentStats.total} comment{commentStats.total !== 1 ? 's' : ''}
                    {commentStats.unresolved > 0 && (
                      <span className="text-amber-600"> ({commentStats.unresolved} open)</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-teal-tint flex items-center justify-center mx-auto mb-2">
                <FolderOpen size={22} className="text-teal" />
              </div>
              <p className="text-xs text-faint">No items yet</p>
            </div>
          )}

          {/* Date overlay */}
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[10px] font-medium text-faint border border-edge">
            {formatDate(project.created_at)}
          </span>
        </button>

        {/* ─── Card body ──────────────────────────────────────── */}
        <div className="p-3.5 flex-1 flex flex-col min-w-0">
          {/* Title */}
          <h3
            className="text-[15px] font-semibold text-ink truncate cursor-pointer hover:text-teal transition-colors mb-1"
            onClick={() => router.push(`/reviews/${project.id}`)}
          >
            {project.title}
          </h3>

          {/* Client / description */}
          {(project.client_name || project.description) && (
            <p className="text-[12px] text-faint truncate mb-2.5">
              {project.client_name}
              {project.client_name && project.description && ' · '}
              {project.description}
            </p>
          )}

          {/* Status dropdown */}
          <div className="mb-3">
            <StatusDropdown
              value={project.status as ProjectStatus}
              options={projectStatusOptions}
              onChange={handleStatusChange}
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* ─── Actions ────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-edge pt-2.5 -mx-3.5 px-3.5">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => router.push(`/reviews/${project.id}`)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal-tint transition-colors"
              >
                <Eye size={12} />
                View
              </button>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition-colors"
              >
                {copied ? <Check size={12} className="text-[#2E7D32]" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Link'}
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 bottom-full mb-1 z-20 bg-white rounded-xl border border-edge shadow-lg py-1 min-w-[140px]">
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Edit Modal ──────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEdit(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-ink">
              Edit Project
            </h3>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-edge rounded-[10px] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 border border-edge rounded-[10px] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors resize-none bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Client Name</label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-edge rounded-[10px] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Client Email</label>
                <input
                  type="email"
                  value={editClientEmail}
                  onChange={(e) => setEditClientEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-edge rounded-[10px] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-colors bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-ink hover:bg-surface rounded-[10px] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim() || saving}
                className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-[10px] hover:bg-teal-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}