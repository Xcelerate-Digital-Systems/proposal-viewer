'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Trash2, ExternalLink, MessageSquareText, CalendarDays,
} from 'lucide-react';
import { supabase, type FeedbackProject } from '@/lib/supabase';
import { buildReviewUrl } from '@/lib/proposal-url';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { getFeedbackStatusDef } from '@/lib/feedback/status';

interface ReviewProjectRowProps {
  project: FeedbackProject;
  onRefresh: () => void;
  customDomain?: string | null;
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};


export default function FeedbackProjectRow({ project, onRefresh, customDomain }: ReviewProjectRowProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);

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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const status = getFeedbackStatusDef(project.status);

  return (
    <div
      onClick={() => router.push(`/campaigns/${project.id}`)}
      className="flex items-center gap-4 px-4 py-3 bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04)] hover:shadow-[0_2px_8px_rgba(20,20,40,0.06)] cursor-pointer transition-shadow group"
    >
      {/* Status badge */}
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-detail font-medium shrink-0 ${status.bg} ${status.text}`}>
        {status.icon}
        {status.label}
      </span>

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
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={copyLink}
          className="p-1.5 rounded-lg text-faint hover:text-teal hover:bg-teal-tint transition-colors"
          title="Copy share link"
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
