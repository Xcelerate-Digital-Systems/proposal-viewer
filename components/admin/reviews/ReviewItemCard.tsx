// components/admin/reviews/ReviewItemCard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trash2, MessageSquareText, CheckCircle2, AlertCircle, Clock,
  Pencil, MoreHorizontal, Eye, Globe, Check, Mail, Smartphone,
  Share2, Loader2, ExternalLink,
} from 'lucide-react';
import { supabase, type ReviewItem, type ReviewItemStatus } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import StatusDropdown, { type StatusOption } from '@/components/ui/StatusDropdown';
import { buildReviewItemUrl } from '@/lib/proposal-url';

interface ReviewItemCardProps {
  item: ReviewItem;
  onRefresh: () => void;
  onOpenViewer: (itemId: string) => void;
  customDomain?: string | null;
}

const itemStatusOptions: StatusOption<ReviewItemStatus>[] = [
  {
    value: 'draft',
    label: 'Draft',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
    icon: <Clock size={13} />,
  },
  {
    value: 'in_review',
    label: 'In Review',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: <Eye size={13} />,
  },
  {
    value: 'approved',
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: <CheckCircle2 size={13} />,
  },
  {
    value: 'revision_needed',
    label: 'Revision Needed',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: <AlertCircle size={13} />,
  },
];

export default function ReviewItemCard({ item, onRefresh, onOpenViewer, customDomain }: ReviewItemCardProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
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

  const handleStatusChange = async (newStatus: ReviewItemStatus) => {
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

  const handleShare = async () => {
    setSharing(true);
    setShowMenu(false);

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

  const thumbnailUrl = item.image_url || item.screenshot_url || item.ad_creative_url;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
      {/* Thumbnail — click to open viewer */}
      <button
        onClick={() => onOpenViewer(item.id)}
        className="w-full aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border-b border-gray-100 relative rounded-t-xl"
      >
        {item.type === 'webpage' ? (
          // Webpage: screenshot if available, otherwise scaled iframe, fallback to icon
          item.screenshot_url ? (
            <div className="w-full h-full relative">
              <img
                src={item.screenshot_url}
                alt={item.title}
                className="w-full h-full object-cover object-top"
              />
              {/* Widget status pill */}
              <div className="absolute bottom-2 left-2 z-20">
                {item.widget_installed_at ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-[10px] font-medium text-white backdrop-blur-sm">
                    <Check size={9} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-[10px] font-medium text-white backdrop-blur-sm">
                    Awaiting install
                  </span>
                )}
              </div>
            </div>
          ) : item.url ? (
            <div className="w-full h-full relative">
              <iframe
                src={item.url}
                title={item.title}
                className="absolute top-0 left-0 border-0 pointer-events-none"
                style={{
                  width: '500%',
                  height: '500%',
                  transform: 'scale(0.2)',
                  transformOrigin: 'top left',
                }}
                sandbox="allow-same-origin"
                loading="lazy"
                tabIndex={-1}
              />
              {/* Overlay to ensure click passes through to button */}
              <div className="absolute inset-0 z-10" />
              {/* Widget status pill */}
              <div className="absolute bottom-2 left-2 z-20">
                {item.widget_installed_at ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-[10px] font-medium text-white backdrop-blur-sm">
                    <Check size={9} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-[10px] font-medium text-white backdrop-blur-sm">
                    Awaiting install
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center mx-auto">
                <Globe size={22} className="text-teal" />
              </div>
              {item.widget_installed_at ? (
                <div className="flex items-center gap-1 justify-center mt-2.5">
                  <Check size={11} className="text-emerald-500" />
                  <p className="text-xs text-emerald-600 font-medium">Connected</p>
                </div>
              ) : (
                <p className="text-xs text-amber-600 mt-2.5">Awaiting install</p>
              )}
            </div>
          )
        ) : item.type === 'email' ? (
          // Email: mini preview of subject + body
          <div className="w-full h-full flex flex-col text-left overflow-hidden bg-white">
            {/* Mini email header bar */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-teal/15 flex items-center justify-center shrink-0">
                  <Mail size={10} className="text-teal" />
                </div>
                <span className="text-[10px] text-gray-400 truncate">Your Brand</span>
              </div>
              <p className="text-xs font-semibold text-gray-800 truncate leading-snug">
                {item.email_subject || 'No subject'}
              </p>
              {item.email_preheader && (
                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                  {item.email_preheader}
                </p>
              )}
            </div>
            {/* Body preview */}
            <div className="flex-1 px-3 py-2 overflow-hidden">
              <p className="text-[10px] leading-relaxed text-gray-500 line-clamp-6 whitespace-pre-line">
                {item.email_body || item.html_content
                  ? (item.email_body || item.html_content || '').replace(/<[^>]*>/g, '').slice(0, 300)
                  : 'No content'}
              </p>
            </div>
          </div>
        ) : item.type === 'sms' ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center mx-auto">
              <Smartphone size={22} className="text-teal" />
            </div>
            <p className="text-xs text-gray-500 font-medium mt-2.5 truncate px-4 max-w-full">
              {item.sms_body ? `${item.sms_body.slice(0, 30)}…` : 'SMS'}
            </p>
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto">
              <Eye size={22} className="text-gray-300" />
            </div>
            <p className="text-xs text-gray-400 mt-2.5">No preview</p>
          </div>
        )}

        {/* Type badge overlay */}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[10px] font-medium text-gray-500 capitalize border border-gray-200/60">
          {item.type === 'ad'
            ? (item.ad_platform === 'instagram_feed' ? 'Instagram Ad' : 'Facebook Ad')
            : item.type === 'webpage'
            ? 'Web Page'
            : item.type}
        </span>

        {/* Version badge */}
        {item.version > 1 && (
          <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[10px] font-medium text-gray-500 border border-gray-200/60">
            v{item.version}
          </span>
        )}
      </button>

      {/* Card body */}
      <div className="p-3.5 flex-1 flex flex-col min-w-0">
        {/* Title */}
        <div className="mb-2.5 min-w-0">
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
                className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal min-w-0"
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

        {/* Status dropdown */}
        <div className="mb-3">
          <StatusDropdown
            value={item.status}
            options={itemStatusOptions}
            onChange={handleStatusChange}
          />
        </div>

        {/* Comments stat */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
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
        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 -mx-3.5 px-3.5">
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
                <div className="absolute right-0 bottom-full mb-1 z-20 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[160px]">
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