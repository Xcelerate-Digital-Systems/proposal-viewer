// components/admin/reviews/ReviewProjectRow.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Trash2, ExternalLink, MessageSquareText,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { supabase, type ReviewProject } from '@/lib/supabase';
import { buildReviewUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface ReviewProjectRowProps {
  project: ReviewProject;
  onRefresh: () => void;
  customDomain?: string | null;
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-[#E8F5E9]', text: 'text-[#2E7D32]' },
  completed: { label: 'Completed', bg: 'bg-teal-tint', text: 'text-teal' },
  archived: { label: 'Archived', bg: 'bg-surface', text: 'text-muted' },
};

export default function ReviewProjectRow({ project, onRefresh, customDomain }: ReviewProjectRowProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const fetchStats = useCallback(async () => {
    const { data: items } = await supabase
      .from('review_items')
      .select('id')
      .eq('review_project_id', project.id);

    if (items) {
      setItemCount(items.length);
      if (items.length > 0) {
        const { count } = await supabase
          .from('review_comments')
          .select('id', { count: 'exact', head: true })
          .in('review_item_id', items.map(i => i.id))
          .is('parent_comment_id', null);
        setCommentCount(count || 0);
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const status = statusConfig[project.status] || statusConfig.active;

  return (
    <div
      onClick={() => router.push(`/reviews/${project.id}`)}
      className="flex items-center gap-4 px-4 py-3 bg-white rounded-[12px] border border-edge hover:border-edge-hover cursor-pointer transition-colors group"
    >
      {/* Status badge */}
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0 ${status.bg} ${status.text}`}>
        {project.status === 'active' && <CheckCircle2 size={10} />}
        {project.status === 'completed' && <Check size={10} />}
        {project.status === 'archived' && <AlertCircle size={10} />}
        {status.label}
      </span>

      {/* Title + client */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
          {project.title}
        </h3>
        {(project.client_name || project.description) && (
          <p className="text-xs text-faint truncate">
            {project.client_name}
            {project.client_name && project.description && ' · '}
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
        <span className="text-xs text-faint shrink-0 hidden md:flex items-center gap-1 w-20 justify-end">
          <MessageSquareText size={11} />
          {commentCount}
        </span>
      )}

      {/* Date */}
      <span className="text-xs text-faint shrink-0 hidden md:block w-16 text-right">
        {formatDate(project.created_at)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copyLink}
          className="p-1.5 rounded-lg text-faint hover:text-teal hover:bg-teal-tint transition-colors"
          title="Copy link"
        >
          {copied ? <Check size={14} className="text-[#2E7D32]" /> : <Copy size={14} />}
        </button>
        <a
          href={`/review/${project.share_token}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition-colors"
          title="Preview"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-lg text-faint hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
