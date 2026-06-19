'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Reply, Check, ExternalLink, Send, X, FileImage, ChevronRight,
  MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatRelative } from '@/lib/format-date';

export type InboxComment = {
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
  replyCount: number;
};

type ReplyRow = {
  id: string;
  content: string;
  author_name: string;
  author_type: 'team' | 'client';
  created_at: string;
};

interface Props {
  item: InboxComment;
  memberName: string;
  isLast?: boolean;
  isSelected?: boolean;
  triggerReply?: number;
  onResolve: (item: InboxComment) => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function InboxItem({ item, memberName, isLast, isSelected, triggerReply, onResolve }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shotPreviewOpen, setShotPreviewOpen] = useState(false);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTriggerRef = useRef(triggerReply);
  const draftKey = `inbox-draft-${item.commentId}`;

  // Scroll into view when selected via keyboard
  useEffect(() => {
    if (isSelected && rootRef.current) {
      rootRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  // Open reply form when triggerReply increments while selected
  useEffect(() => {
    if (isSelected && triggerReply !== undefined && triggerReply !== prevTriggerRef.current) {
      setReplyOpen(true);
    }
    prevTriggerRef.current = triggerReply;
  }, [isSelected, triggerReply]);
  const openHref = `/campaigns/${item.projectId}/assets/${item.itemId}`;
  const color = avatarColor(item.clientName);
  const isAging = (Date.now() - new Date(item.createdAt).getTime()) > 48 * 60 * 60 * 1000;

  // Restore draft when reply panel opens
  useEffect(() => {
    if (!replyOpen) return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) setReplyText(saved);
    } catch {
      // sessionStorage unavailable — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyOpen]);

  // Debounce-save draft to sessionStorage while typing
  useEffect(() => {
    if (!replyOpen) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        if (replyText) {
          sessionStorage.setItem(draftKey, replyText);
        } else {
          sessionStorage.removeItem(draftKey);
        }
      } catch {
        // sessionStorage unavailable — ignore
      }
    }, 300);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyText, replyOpen]);

  const clearDraft = useCallback(() => {
    try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
  }, [draftKey]);

  const sendReply = async (andResolve: boolean) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
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
      clearDraft();
      if (andResolve) {
        onResolve(item);
      } else {
        setReplyText('');
        setReplyOpen(false);
      }
    } catch (e) {
      console.error('Reply failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const toggleReplies = useCallback(async () => {
    if (repliesExpanded) {
      setRepliesExpanded(false);
      return;
    }
    setRepliesExpanded(true);
    if (replies.length > 0) return;
    setRepliesLoading(true);
    try {
      const { data } = await supabase
        .from('review_comments')
        .select('id, content, author_name, author_type, created_at')
        .eq('parent_comment_id', item.commentId)
        .order('created_at', { ascending: true });
      setReplies((data || []) as ReplyRow[]);
    } catch {
      setReplies([]);
      setRepliesError(true);
    } finally {
      setRepliesLoading(false);
    }
  }, [repliesExpanded, replies.length, item.commentId]);

  const closeLightbox = useCallback(() => setShotPreviewOpen(false), []);

  useEffect(() => {
    if (!shotPreviewOpen) return;
    lightboxCloseRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [shotPreviewOpen, closeLightbox]);

  return (
    <div ref={rootRef} data-inbox-item className={`px-5 py-4 ${!isLast ? 'border-b border-edge' : ''} ${isAging ? 'bg-amber-50/40' : ''} ${isSelected ? 'ring-2 ring-primary/20 rounded-lg bg-primary/[0.02]' : ''}`}>
      <div className="flex gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${color.bg} ${color.text}`}>
          {initials(item.clientName)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-caption font-semibold text-ink">{item.clientName}</span>
            <time
              dateTime={item.createdAt}
              className={`text-detail ml-auto shrink-0 ${isAging ? 'text-amber-600 font-medium' : 'text-faint'}`}
            >
              {isAging && <span className="sr-only">Overdue: </span>}
              {formatRelative(item.createdAt)}
            </time>
          </div>

          <div className="flex items-center gap-1.5 text-xs mt-1 min-w-0">
            <span className="font-medium text-ink truncate">{item.projectName}</span>
            <ChevronRight size={11} className="text-faint shrink-0" aria-hidden="true" />
            <span className="text-muted truncate">{item.itemTitle}</span>
          </div>

          <div className="flex gap-3 mt-2.5">
            <div className="flex-1 min-w-0">
              <p
                className={`text-caption text-ink/85 whitespace-pre-wrap ${
                  expanded ? '' : 'line-clamp-3'
                }`}
              >
                {item.content.replace(/<[^>]+>/g, '')}
              </p>
              {item.content.length > 220 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-detail text-primary hover:underline mt-1"
                  aria-expanded={expanded}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>

            {item.screenshotUrl && (
              <button
                type="button"
                onClick={() => setShotPreviewOpen(true)}
                className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-surface ring-1 ring-edge hover:ring-primary/40 transition-all group"
                aria-label={`View screenshot for ${item.itemTitle}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.screenshotUrl}
                  alt={`Client screenshot of ${item.itemTitle}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <FileImage size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                </span>
              </button>
            )}
          </div>

          {item.replyCount > 0 && (
            <div className="mt-2.5">
              <button
                onClick={toggleReplies}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
              >
                <MessageSquare size={12} />
                {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
                {repliesExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {repliesExpanded && (
                <div className="mt-2 ml-1 border-l-2 border-edge pl-3 space-y-2">
                  {repliesLoading ? (
                    <div className="space-y-2 animate-pulse py-1">
                      {Array.from({ length: Math.min(item.replyCount, 3) }).map((_, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-edge shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="h-2.5 bg-edge rounded w-1/3" />
                            <div className="h-2.5 bg-edge rounded w-2/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : repliesError ? (
                    <div className="py-2 text-center">
                      <p className="text-detail text-muted">Failed to load replies.</p>
                      <button
                        onClick={() => { setRepliesError(false); setRepliesExpanded(false); toggleReplies(); }}
                        className="text-detail font-medium text-primary hover:text-primary-hover mt-1"
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    replies.map((r) => {
                      const rColor = avatarColor(r.author_name);
                      return (
                        <div key={r.id} className="flex items-start gap-2 py-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-semibold shrink-0 ${rColor.bg} ${rColor.text}`}>
                            {initials(r.author_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-detail font-semibold text-ink">{r.author_name}</span>
                              {r.author_type === 'team' && (
                                <span className="text-2xs font-medium text-primary bg-primary/10 rounded px-1 py-px">Team</span>
                              )}
                              <time className="text-detail text-faint ml-auto shrink-0">{formatRelative(r.created_at)}</time>
                            </div>
                            <p className="text-detail text-ink/80 line-clamp-2 whitespace-pre-wrap mt-0.5">
                              {r.content.replace(/<[^>]+>/g, '')}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {replyOpen && (
            <div className="mt-3 rounded-2xl border border-edge-strong bg-surface/50 p-2.5">
              <textarea
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${item.clientName}...`}
                rows={3}
                className="w-full bg-white border border-edge-strong rounded-lg px-3 py-2 text-caption text-ink placeholder-faint outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
                disabled={sending}
              />
              {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    clearDraft();
                    setReplyOpen(false);
                    setReplyText('');
                    setError(null);
                  }}
                  disabled={sending}
                  className="text-xs font-medium text-muted hover:text-ink px-2 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendReply(false)}
                  disabled={sending || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 bg-white border border-edge-strong hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed text-ink text-xs font-semibold rounded-full px-3 py-1.5 transition-colors"
                >
                  <Send size={12} />
                  {sending ? 'Sending…' : 'Send reply'}
                </button>
                <button
                  onClick={() => sendReply(true)}
                  disabled={sending || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-full px-3 py-1.5 transition-colors"
                >
                  <Check size={12} />
                  {sending ? 'Sending…' : 'Reply & resolve'}
                </button>
              </div>
            </div>
          )}

          {!replyOpen && (
            <div className="flex items-center gap-1 mt-3">
              <button
                onClick={() => setReplyOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink bg-surface hover:bg-edge rounded-full px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <Reply size={12} />
                Reply
              </button>
              <button
                onClick={() => onResolve(item)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink rounded-full px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <Check size={12} />
                Resolve
              </button>
              <Link
                href={openHref}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover rounded-full px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ml-auto"
              >
                <ExternalLink size={12} />
                Open
              </Link>
            </div>
          )}
        </div>
      </div>

      {shotPreviewOpen && item.screenshotUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshot preview for ${item.itemTitle}`}
          onClick={closeLightbox}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
        >
          <button
            ref={lightboxCloseRef}
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white flex items-center justify-center"
            aria-label="Close screenshot"
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.screenshotUrl}
            alt={`Client screenshot of ${item.itemTitle}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
