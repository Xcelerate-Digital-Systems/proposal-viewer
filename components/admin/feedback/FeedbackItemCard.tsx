'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trash2, MessageSquareText, Pencil, MoreHorizontal, Eye, Check,
  Share2, Loader2, ExternalLink, Link as LinkIcon,
} from 'lucide-react';
import { supabase, type FeedbackItem, type FeedbackStatus } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import { buildReviewItemUrl } from '@/lib/proposal-url';
import { REVIEW_STATUS_OPTIONS } from '@/lib/feedback/status';
import FeedbackItemThumb from './FeedbackItemThumb';

interface ReviewItemCardProps {
  item: FeedbackItem;
  onRefresh: () => void;
  onOpenViewer: (itemId: string) => void;
  customDomain?: string | null;
}

const itemStatusOptions: StatusOption<FeedbackStatus>[] = REVIEW_STATUS_OPTIONS.map((s) => ({
  value: s.value,
  label: s.label,
  bg: s.bg,
  text: s.text,
  border: s.border,
  icon: s.icon,
}));

export default function FeedbackItemCard({ item, onRefresh, onOpenViewer, customDomain }: ReviewItemCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editingUrl, setEditingUrl] = useState(false);
  const [editUrl, setEditUrl] = useState(item.url || '');
  const [saving, setSaving] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [sharing, setSharing] = useState(false);

  const fetchCommentStats = useCallback(async () => {
    const { data } = await supabase
      .from('review_comments')
      .select('resolved')
      .eq('review_item_id', item.id)
      .is('parent_comment_id', null);

    if (data) {
      setCommentCount(data.length);
      setUnresolvedCount(data.filter((c) => !c.resolved).length);
    }
  }, [item.id]);

  useEffect(() => {
    fetchCommentStats();
  }, [fetchCommentStats]);

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    const { error } = await supabase
      .from('review_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      const label = itemStatusOptions.find((o) => o.value === newStatus)?.label ?? newStatus;
      toast.success(`Status changed to ${label}`);
      onRefresh();
    }
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('review_items')
      .update({ title: editTitle.trim(), updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update title');
    } else {
      setEditing(false);
      onRefresh();
    }
    setSaving(false);
  };

  const handleSaveUrl = async () => {
    const trimmed = editUrl.trim();
    if (!trimmed) {
      toast.error('URL cannot be empty');
      return;
    }
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      new URL(normalized);
    } catch {
      toast.error('Enter a valid URL');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('review_items')
      .update({ url: normalized, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update URL');
    } else {
      setEditingUrl(false);
      toast.success('URL updated');
      onRefresh();
    }
    setSaving(false);
  };

  const handleShare = async () => {
    setSharing(true);
    setShowMenu(false);

    // Webpages: share the live URL — that's where the widget collects
    // feedback. The in-app viewer is a no-op for webpage items now.
    if (item.type === 'webpage' && item.url) {
      await navigator.clipboard.writeText(item.url);
      toast.success('Page URL copied to clipboard');
      setSharing(false);
      return;
    }

    let token = item.share_token;

    // Generate token if none exists
    if (!token) {
      const generated = crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase
        .from('review_items')
        .update({ share_token: generated, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) {
        toast.error('Failed to generate share link');
        setSharing(false);
        return;
      }
      token = generated;
      onRefresh();
    }

    const url = buildReviewItemUrl(token, customDomain, window.location.origin);
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied to clipboard');
    setSharing(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Item',
      message: `Delete "${item.title}"? All comments on this item will also be deleted.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    // Delete storage file if it's an image
    if (item.image_url) {
      try {
        const url = new URL(item.image_url);
        const pathMatch = url.pathname.match(/\/object\/public\/company-assets\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from('company-assets').remove([pathMatch[1]]);
        }
      } catch {
        // Ignore storage cleanup errors
      }
    }

    await supabase.from('review_items').delete().eq('id', item.id);
    toast.success('Item deleted');
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_4px_16px_rgba(20,20,40,0.04)] hover:shadow-[0_2px_4px_rgba(20,20,40,0.06),0_8px_24px_rgba(20,20,40,0.06)] transition-shadow flex flex-col">
      {/* Thumbnail — click to open viewer */}
      <button
        onClick={() => onOpenViewer(item.id)}
        className="w-full aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative rounded-t-2xl"
      >
        <FeedbackItemThumb item={item} />
      </button>

      {/* Card body */}
      <div className="p-3 flex-1 flex flex-col min-w-0">
        {/* Title */}
        <div className="mb-2 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') { setEditing(false); setEditTitle(item.title); }
                }}
                className="flex-1 px-2.5 py-1.5 bg-gray-50 rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/20 min-w-0"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                disabled={!editTitle.trim() || saving}
                className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <h4
                className="text-sm font-semibold text-gray-900 truncate cursor-pointer hover:text-teal transition-colors"
                onClick={() => onOpenViewer(item.id)}
              >
                {item.title}
              </h4>
              <button
                onClick={() => setEditing(true)}
                className="p-0.5 rounded text-gray-300 hover:text-gray-500 transition-colors shrink-0"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
        </div>

        {/* URL editor (webpage only) */}
        {item.type === 'webpage' && editingUrl && (
          <div className="mb-2.5 flex items-center gap-1.5 min-w-0">
            <input
              type="url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveUrl();
                if (e.key === 'Escape') { setEditingUrl(false); setEditUrl(item.url || ''); }
              }}
              placeholder="https://example.com/page"
              className="flex-1 px-2.5 py-1.5 bg-gray-50 rounded-xl text-xs text-ink font-mono focus:outline-none focus:ring-2 focus:ring-teal/20 min-w-0"
              autoFocus
            />
            <button
              onClick={handleSaveUrl}
              disabled={!editUrl.trim() || saving}
              className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              <Check size={14} />
            </button>
          </div>
        )}

        {/* Status dropdown */}
        <div className="mb-2">
          <StatusDropdown
            value={item.status}
            options={itemStatusOptions}
            onChange={handleStatusChange}
          />
        </div>

        {/* Comments stat */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <MessageSquareText size={12} />
          <span>
            {commentCount} comment{commentCount !== 1 ? 's' : ''}
            {unresolvedCount > 0 && (
              <span className="text-amber-600 ml-1">({unresolvedCount} open)</span>
            )}
          </span>
        </div>

        {/* Spacer to push actions to bottom */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 -mx-3 px-3">
          <button
            onClick={() => onOpenViewer(item.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-teal hover:bg-teal/5 transition-colors"
          >
            <Eye size={13} />
            View
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 bottom-full mb-1 z-20 bg-white rounded-xl border border-gray-100 shadow-[0_4px_24px_rgba(20,20,40,0.08)] py-1 min-w-[160px]">
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {sharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                    Copy Share Link
                  </button>
                  {item.type === 'webpage' && item.url && (
                    <a href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink size={14} />
                      Open Page
                    </a>
                  )}
                  {item.type === 'webpage' && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setEditUrl(item.url || '');
                        setEditingUrl(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LinkIcon size={14} />
                      Edit URL
                    </button>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setShowMenu(false); handleDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Delete Item
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}