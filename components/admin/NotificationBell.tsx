// components/admin/NotificationBell.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Bell, Eye, CheckCircle2, XCircle, PenLine, MessageSquare,
  CheckCheck, Layers, Package, PartyPopper, AtSign,
} from 'lucide-react';
import { useNotifications, type InAppNotification } from '@/hooks/useNotifications';

const CATEGORY_ICON: Record<string, typeof Bell> = {
  proposal_viewed: Eye,
  proposal_accepted: CheckCircle2,
  proposal_declined: XCircle,
  proposal_revision_requested: PenLine,
  comment_added: MessageSquare,
  comment_resolved: CheckCheck,
  review_comment: MessageSquare,
  review_status: Layers,
  review_new_version: Package,
  review_complete: PartyPopper,
  mention: AtSign,
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell({
  userId,
  companyId,
  variant = 'header',
}: {
  userId: string | null;
  companyId: string | null;
  variant?: 'header' | 'sidebar';
}) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId, companyId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      if (variant === 'sidebar') {
        setPos({ bottom: window.innerHeight - r.top + 8, left: r.left });
      } else {
        setPos({ top: r.bottom + 8, left: r.right - 340 });
      }
    }
  }, [open, variant]);

  const handleClick = (n: InAppNotification) => {
    if (!n.read_at) markRead(n.id);
    if (n.link) {
      router.push(n.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`relative p-1.5 rounded-full transition-colors ${
          variant === 'sidebar'
            ? 'text-white/50 hover:text-white hover:bg-surface-dark-hover'
            : 'text-dim hover:text-ink hover:bg-gray-100'
        }`}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-2xs font-bold text-white px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={ref}
          className="fixed w-[340px] max-h-[420px] bg-white rounded-2xl shadow-xl border border-edge overflow-hidden z-[9999] flex flex-col"
          style={{
            ...(pos.top != null ? { top: pos.top } : {}),
            ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
            left: pos.left,
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-teal hover:text-teal/80 font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-faint">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = CATEGORY_ICON[n.category] || Bell;
                const isUnread = !n.read_at;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface transition-colors border-b border-gray-50 ${
                      isUnread ? 'bg-teal/[0.03]' : ''
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      isUnread ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-faint'
                    }`}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-caption leading-snug ${isUnread ? 'font-medium text-ink' : 'text-prose'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-faint mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-detail text-faint mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {isUnread && (
                      <div className="mt-2 w-2 h-2 rounded-full bg-teal shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
