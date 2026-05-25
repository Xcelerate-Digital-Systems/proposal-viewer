'use client';

/**
 * Dashboard inbox row — a single unresolved client comment with the actual
 * comment body, the project/item context, a screenshot thumbnail (when the
 * client captured one), an inline reply composer, and resolve / open
 * actions. Used by the dashboard's "Needs your reply" panel so the agency
 * can triage without leaving the page.
 *
 * Two kinds of comments flow through here:
 *   - 'proposal' → proposal_comments (reply via direct supabase insert)
 *   - 'review'   → review_comments  (reply via direct supabase insert)
 * Both inserts run client-side and rely on RLS to scope by company_id.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Reply, Check, ExternalLink, Send, X, FileText, MessageSquareText, FileImage, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type InboxComment =
  | {
      kind: 'proposal';
      commentId: string;
      proposalId: string;
      proposalTitle: string;
      clientName: string;
      content: string;
      createdAt: string;
      pageNumber: number | null;
      companyId: string;
    }
  | {
      kind: 'review';
      commentId: string;
      projectId: string;
      projectName: string;
      itemId: string;
      itemTitle: string;
      clientName: string;
      content: string;
      createdAt: string;
      screenshotUrl: string | null;
      companyId: string;
    };

interface Props {
  item: InboxComment;
  memberName: string;
  isLast?: boolean;
  /** Called when the row should disappear (reply sent or resolved). */
  onDismiss: () => void;
}

function formatRelative(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function InboxItem({ item, memberName, isLast, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shotPreviewOpen, setShotPreviewOpen] = useState(false);

  const isProposal = item.kind === 'proposal';
  const tone = isProposal
    ? { bg: '#E6F5F3', color: '#017C87', label: 'Proposal' }
    : { bg: '#F3E8FF', color: '#7C3AED', label: 'Feedback' };
  const ContextIcon = isProposal ? FileText : MessageSquareText;

  const openHref = isProposal
    ? `/proposals/${item.proposalId}/pages${item.pageNumber ? `?page=${item.pageNumber}` : ''}`
    : `/feedback/${item.projectId}/items/${item.itemId}`;

  // Breadcrumb context — what the comment is attached to. Reviews get
  // Project → Item, proposals get Title · Page N.
  const breadcrumb = isProposal ? (
    <>
      <span className="font-medium text-ink truncate">{item.proposalTitle}</span>
      {item.pageNumber != null && (
        <>
          <ChevronRight size={11} className="text-faint shrink-0" />
          <span className="text-muted shrink-0">Page {item.pageNumber}</span>
        </>
      )}
    </>
  ) : (
    <>
      <span className="font-medium text-ink truncate">{item.projectName}</span>
      <ChevronRight size={11} className="text-faint shrink-0" />
      <span className="text-muted truncate">{item.itemTitle}</span>
    </>
  );

  const screenshotUrl = !isProposal ? item.screenshotUrl : null;

  const sendReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      if (item.kind === 'proposal') {
        const { error: insertErr } = await supabase.from('proposal_comments').insert({
          proposal_id: item.proposalId,
          parent_id: item.commentId,
          author_name: memberName,
          author_type: 'team',
          content: trimmed,
          page_number: item.pageNumber,
          is_internal: false,
          company_id: item.companyId,
        });
        if (insertErr) throw insertErr;
      } else {
        const { error: insertErr } = await supabase.from('review_comments').insert({
          review_item_id: item.itemId,
          parent_comment_id: item.commentId,
          author_name: memberName,
          author_type: 'team',
          content: trimmed,
          comment_type: 'general',
          company_id: item.companyId,
        });
        if (insertErr) throw insertErr;
      }
      // Mark the parent comment resolved — we replied, the ball is back in
      // the client's court. They can comment again to reopen.
      await markResolved(false);
      onDismiss();
    } catch (e) {
      console.error('Reply failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to send reply');
      setSending(false);
    }
  };

  const markResolved = async (dismissOnSuccess = true) => {
    setResolving(true);
    setError(null);
    try {
      if (item.kind === 'proposal') {
        const { error: updErr } = await supabase
          .from('proposal_comments')
          .update({ resolved_at: new Date().toISOString(), resolved_by: memberName })
          .eq('id', item.commentId);
        if (updErr) throw updErr;
      } else {
        const { error: updErr } = await supabase
          .from('review_comments')
          .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: memberName })
          .eq('id', item.commentId);
        if (updErr) throw updErr;
      }
      if (dismissOnSuccess) onDismiss();
    } catch (e) {
      console.error('Resolve failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to resolve');
      setResolving(false);
    }
  };

  return (
    <div className={`px-5 py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0"
          style={{ backgroundColor: tone.bg, color: tone.color }}
        >
          {initials(item.clientName)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: author + type badge + time */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-ink">{item.clientName}</span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: tone.bg, color: tone.color }}
            >
              <ContextIcon size={10} />
              {tone.label}
            </span>
            <span className="text-[11px] text-faint ml-auto shrink-0">
              {formatRelative(item.createdAt)}
            </span>
          </div>

          {/* Breadcrumb — clearly identifies which proposal/project+item */}
          <div className="flex items-center gap-1.5 text-[12px] mt-1 min-w-0">
            {breadcrumb}
          </div>

          {/* Body row — comment text + (optional) screenshot thumb */}
          <div className="flex gap-3 mt-2.5">
            <div className="flex-1 min-w-0">
              <p
                className={`text-[13px] text-ink/85 whitespace-pre-wrap ${
                  expanded ? '' : 'line-clamp-3'
                }`}
              >
                {item.content}
              </p>
              {item.content.length > 220 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[11px] text-teal hover:underline mt-1"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>

            {screenshotUrl && (
              <button
                type="button"
                onClick={() => setShotPreviewOpen(true)}
                className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-surface ring-1 ring-gray-200 hover:ring-teal/40 transition-all group"
                title="View screenshot"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotUrl}
                  alt="Screenshot from client"
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <FileImage size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
            )}
          </div>

          {/* Reply composer */}
          {replyOpen && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-surface/50 p-2.5">
              <textarea
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${item.clientName}...`}
                rows={3}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-ink placeholder-faint outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 resize-none"
                disabled={sending}
              />
              {error && <p className="text-[11px] text-red-600 mt-1.5">{error}</p>}
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setReplyOpen(false);
                    setReplyText('');
                    setError(null);
                  }}
                  disabled={sending}
                  className="text-[12px] font-medium text-muted hover:text-ink px-2 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 bg-teal hover:bg-teal-hover disabled:bg-teal/50 disabled:cursor-not-allowed text-white text-[12px] font-semibold rounded-full px-3 py-1.5 transition-colors"
                >
                  <Send size={12} />
                  {sending ? 'Sending…' : 'Reply & resolve'}
                </button>
              </div>
            </div>
          )}

          {/* Action row */}
          {!replyOpen && (
            <div className="flex items-center gap-1 mt-3">
              <button
                onClick={() => setReplyOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink bg-surface hover:bg-gray-100 rounded-full px-3 py-1.5 transition-colors"
              >
                <Reply size={12} />
                Reply
              </button>
              <button
                onClick={() => markResolved()}
                disabled={resolving}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {resolving ? <X size={12} className="animate-pulse" /> : <Check size={12} />}
                {resolving ? 'Resolving…' : 'Resolve'}
              </button>
              <Link
                href={openHref}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-teal hover:text-teal-hover rounded-full px-3 py-1.5 transition-colors ml-auto"
              >
                <ExternalLink size={12} />
                Open
              </Link>
            </div>
          )}
          {!replyOpen && error && (
            <p className="text-[11px] text-red-600 mt-1.5">{error}</p>
          )}
        </div>
      </div>

      {/* Screenshot lightbox */}
      {shotPreviewOpen && screenshotUrl && (
        <div
          onClick={() => setShotPreviewOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShotPreviewOpen(false); }}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white flex items-center justify-center"
            title="Close"
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt="Screenshot"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
