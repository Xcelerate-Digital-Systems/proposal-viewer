// components/admin/reviews/ReviewItemCard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trash2, MessageSquareText, CheckCircle2, AlertCircle,
  Clock, GripVertical, Pencil, MoreHorizontal, Eye,
} from 'lucide-react';
import { supabase, type ReviewItem, type ReviewItemStatus } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface ReviewItemCardProps {
  item: ReviewItem;
  onRefresh: () => void;
  onOpenViewer: (itemId: string) => void;
}

const statusConfig: Record<ReviewItemStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  draft: {
    label: 'Draft',
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    icon: <Clock size={12} />,
  },
  in_review: {
    label: 'In Review',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: <Eye size={12} />,
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: <CheckCircle2 size={12} />,
  },
  revision_needed: {
    label: 'Revision Needed',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: <AlertCircle size={12} />,
  },
};

const statusOptions: { value: ReviewItemStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'revision_needed', label: 'Revision Needed' },
];

export default function ReviewItemCard({ item, onRefresh, onOpenViewer }: ReviewItemCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [saving, setSaving] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);

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

  const handleStatusChange = async (newStatus: ReviewItemStatus) => {
    const { error } = await supabase
      .from('review_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Status changed to ${statusConfig[newStatus].label}`);
      onRefresh();
    }
    setShowMenu(false);
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

  const status = statusConfig[item.status];

  // Thumbnail URL
  const thumbnailUrl = item.image_url || item.screenshot_url || item.ad_creative_url;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:border-gray-300 transition-colors">
      <div className="flex">
        {/* Thumbnail */}
        <button
          onClick={() => onOpenViewer(item.id)}
          className="w-[180px] shrink-0 bg-gray-50 border-r border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              style={{ minHeight: 120, maxHeight: 140 }}
            />
          ) : (
            <div className="p-6 text-center">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto">
                <Eye size={18} className="text-gray-300" />
              </div>
              <p className="text-xs text-gray-400 mt-2">No preview</p>
            </div>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') { setEditing(false); setEditTitle(item.title); }
                    }}
                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#017C87]/20 focus:border-[#017C87]"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={!editTitle.trim() || saving}
                    className="px-3 py-1.5 bg-[#017C87] text-white text-xs font-medium rounded-lg hover:bg-[#01434A] disabled:opacity-50"
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditTitle(item.title); }}
                    className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h4
                    className="text-sm font-semibold text-gray-900 truncate cursor-pointer hover:text-[#017C87] transition-colors"
                    onClick={() => onOpenViewer(item.id)}
                  >
                    {item.title}
                  </h4>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}

              {/* Type + version */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 capitalize">
                  {item.type === 'ad'
                    ? (item.ad_platform === 'instagram_feed' ? 'Instagram Ad' : 'Facebook Ad')
                    : item.type}
                </span>
                {item.version > 1 && (
                  <>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">v{item.version}</span>
                  </>
                )}
              </div>
            </div>

            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} shrink-0`}>
              {status.icon}
              {status.label}
            </span>
          </div>

          {/* Bottom row: stats + actions */}
          <div className="flex items-center justify-between">
            {/* Comment stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <MessageSquareText size={13} />
                <span>
                  {commentCount} comment{commentCount !== 1 ? 's' : ''}
                  {unresolvedCount > 0 && (
                    <span className="text-amber-600 ml-1">({unresolvedCount} open)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 relative">
              <button
                onClick={() => onOpenViewer(item.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#017C87] hover:bg-[#017C87]/5 transition-colors"
              >
                <Eye size={13} />
                View & Comment
              </button>

              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 bottom-full mb-1 z-20 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[180px]">
                    {/* Status options */}
                    <div className="px-3 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Set Status
                      </span>
                    </div>
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                          item.status === opt.value ? 'text-[#017C87] font-medium' : 'text-gray-700'
                        }`}
                      >
                        {statusConfig[opt.value].icon}
                        {opt.label}
                        {item.status === opt.value && (
                          <CheckCircle2 size={12} className="ml-auto text-[#017C87]" />
                        )}
                      </button>
                    ))}

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
    </div>
  );
}