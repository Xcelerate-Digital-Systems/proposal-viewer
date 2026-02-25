// components/admin/reviews/ReviewProjectCard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Trash2, ExternalLink, MessageSquareText,
  Image, CheckCircle2, AlertCircle, MoreHorizontal, Pencil,
  Archive, RotateCcw,
} from 'lucide-react';
import { supabase, type ReviewProject } from '@/lib/supabase';
import { buildReviewUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface ReviewProjectCardProps {
  project: ReviewProject;
  onRefresh: () => void;
  customDomain?: string | null;
}

type ItemStats = {
  total: number;
  approved: number;
  revision_needed: number;
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

const statusConfig = {
  active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  archived: { label: 'Archived', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
};

export default function ReviewProjectCard({ project, onRefresh, customDomain }: ReviewProjectCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description || '');
  const [editClientName, setEditClientName] = useState(project.client_name || '');
  const [editClientEmail, setEditClientEmail] = useState(project.client_email || '');
  const [saving, setSaving] = useState(false);
  const [itemStats, setItemStats] = useState<ItemStats>({ total: 0, approved: 0, revision_needed: 0 });
  const [commentStats, setCommentStats] = useState<CommentStats>({ total: 0, resolved: 0, unresolved: 0 });

  const fetchStats = useCallback(async () => {
    // Fetch item IDs and statuses for this project
    const { data: items } = await supabase
      .from('review_items')
      .select('id, status')
      .eq('review_project_id', project.id);

    if (items) {
      setItemStats({
        total: items.length,
        approved: items.filter(i => i.status === 'approved').length,
        revision_needed: items.filter(i => i.status === 'revision_needed').length,
      });

      // Fetch comment stats using item IDs
      if (items.length > 0) {
        const itemIds = items.map(i => i.id);
        const { data: comments } = await supabase
          .from('review_comments')
          .select('resolved')
          .in('review_item_id', itemIds)
          .is('parent_comment_id', null); // Only top-level threads

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

  const handleArchive = async () => {
    const newStatus = project.status === 'archived' ? 'active' : 'archived';
    await supabase.from('review_projects').update({ status: newStatus }).eq('id', project.id);
    toast.success(newStatus === 'archived' ? 'Project archived' : 'Project restored');
    setShowMenu(false);
    onRefresh();
  };

  const handleComplete = async () => {
    const newStatus = project.status === 'completed' ? 'active' : 'completed';
    await supabase.from('review_projects').update({ status: newStatus }).eq('id', project.id);
    toast.success(newStatus === 'completed' ? 'Project marked complete' : 'Project reopened');
    setShowMenu(false);
    onRefresh();
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
      setEditing(false);
      onRefresh();
    }
    setSaving(false);
  };

  const status = statusConfig[project.status];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-colors hover:border-gray-300">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3
                className="text-base font-semibold font-[family-name:var(--font-display)] truncate text-gray-900 cursor-pointer hover:text-[#017C87] transition-colors"
                onClick={() => router.push(`/reviews/${project.id}`)}
              >
                {project.title}
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {project.client_name && (
                <>
                  <span className="truncate max-w-[200px]">{project.client_name}</span>
                  <span className="text-gray-200">&middot;</span>
                </>
              )}
              {project.description && (
                <>
                  <span className="truncate max-w-[300px]">{project.description}</span>
                  <span className="text-gray-200">&middot;</span>
                </>
              )}
              <span>{formatDate(project.created_at)}</span>
            </div>
          </div>
        </div>

        {/* ─── Stats row ───────────────────────────────────────── */}
        <div className="flex items-center gap-5 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Image size={14} className="text-gray-400" />
            <span>{itemStats.total} item{itemStats.total !== 1 ? 's' : ''}</span>
          </div>
          {itemStats.approved > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 size={14} />
              <span>{itemStats.approved} approved</span>
            </div>
          )}
          {itemStats.revision_needed > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600">
              <AlertCircle size={14} />
              <span>{itemStats.revision_needed} revision{itemStats.revision_needed !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <MessageSquareText size={14} className="text-gray-400" />
            <span>
              {commentStats.total} comment{commentStats.total !== 1 ? 's' : ''}
              {commentStats.unresolved > 0 && (
                <span className="text-amber-600"> ({commentStats.unresolved} open)</span>
              )}
            </span>
          </div>
        </div>

        {/* ─── Actions ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 -mx-5 px-5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push(`/reviews/${project.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
            >
              <Image size={13} />
              Items
            </button>

            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

            <a
              href={`/review/${project.share_token}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={13} />
              Preview
            </a>

            <button
              onClick={() => setEditing(!editing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                editing
                  ? 'text-[#017C87] bg-[#017C87]/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Pencil size={13} />
              Edit
            </button>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 bottom-full mb-1 z-20 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={handleComplete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <CheckCircle2 size={14} />
                    {project.status === 'completed' ? 'Reopen' : 'Mark Complete'}
                  </button>
                  <button
                    onClick={handleArchive}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {project.status === 'archived' ? <RotateCcw size={14} /> : <Archive size={14} />}
                    {project.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                  <div className="border-t border-gray-100 my-1" />
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

      {/* ─── Edit Panel ────────────────────────────────────────── */}
      {editing && (
        <div className="border-t border-gray-200 bg-gray-50 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] transition-colors bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] transition-colors resize-none bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Name</label>
              <input
                type="text"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] transition-colors bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Email</label>
              <input
                type="email"
                value={editClientEmail}
                onChange={(e) => setEditClientEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87] transition-colors bg-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setEditing(false);
                setEditTitle(project.title);
                setEditDescription(project.description || '');
                setEditClientName(project.client_name || '');
                setEditClientEmail(project.client_email || '');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || saving}
              className="px-4 py-2 bg-[#017C87] text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}