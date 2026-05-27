'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Share2, Copy, Check, ExternalLink, Loader2, ChevronDown,
  GitBranch, Columns3, LayoutGrid,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_SHARED_VIEWS, type FeedbackSharedViews } from '@/lib/types/feedback';

interface ShareMenuProps {
  projectId: string;
  shareToken: string;
  sharedViews: FeedbackSharedViews | null | undefined;
  buildUrl: (token: string) => string;
  onViewsChange: (next: FeedbackSharedViews) => void;
}

const TAB_OPTIONS: { key: keyof FeedbackSharedViews; label: string; Icon: typeof GitBranch }[] = [
  { key: 'board', label: 'Whiteboard', Icon: GitBranch },
  { key: 'kanban', label: 'Kanban', Icon: Columns3 },
  { key: 'items', label: 'Items', Icon: LayoutGrid },
];

/**
 * Project-level share control. Single share link drives a tabbed public
 * viewer at /review/[token]; the toggles below pick which tabs the
 * recipient sees. Toggles are project-wide — every visitor with the link
 * sees the same set.
 */
export default function ShareMenu({
  projectId,
  shareToken,
  sharedViews,
  buildUrl,
  onViewsChange,
}: ShareMenuProps) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof FeedbackSharedViews | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const views = sharedViews ?? DEFAULT_SHARED_VIEWS;
  const url = buildUrl(shareToken);
  const enabledCount = (views.board ? 1 : 0) + (views.kanban ? 1 : 0) + (views.items ? 1 : 0);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Share link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
  }, [url, toast]);

  const toggleView = useCallback(async (key: keyof FeedbackSharedViews) => {
    const next: FeedbackSharedViews = { ...views, [key]: !views[key] };
    if (!next.board && !next.kanban && !next.items) {
      toast.error('At least one view must stay shared');
      return;
    }
    setSavingKey(key);
    try {
      const { data: session } = await supabase.auth.getSession();
      const authToken = session.session?.access_token;
      if (!authToken) { toast.error('Not authenticated'); return; }

      const res = await fetch(`/api/reviews/${projectId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ shared_views: next }),
      });

      if (!res.ok) { toast.error('Failed to update'); return; }

      const data = await res.json();
      onViewsChange(data.shared_views as FeedbackSharedViews);
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingKey(null);
    }
  }, [views, projectId, onViewsChange, toast]);

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <button
        onClick={copyUrl}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-l-lg border-r-0 transition-colors text-teal border-teal/30 bg-teal/5 hover:bg-teal/10"
      >
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button
        onClick={() => setMenuOpen((s) => !s)}
        className="flex items-center px-1.5 py-2 rounded-r-lg border border-teal/30 bg-teal/5 hover:bg-teal/10 text-teal transition-colors"
        title="Sharing settings"
      >
        <ChevronDown size={12} />
      </button>

      {menuOpen && (
        <div
          className="fixed z-[9999] bg-white rounded-2xl border border-edge-strong shadow-lg w-[280px] py-2"
          style={{
            top: (menuRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: Math.min(
              menuRef.current?.getBoundingClientRect().right ?? 0,
              window.innerWidth - 290
            ) - 280,
          }}
        >
          <div className="px-3 pt-1 pb-2">
            <p className="text-detail uppercase tracking-wide font-semibold text-faint">
              Tabs visible to reviewers
            </p>
            <p className="text-detail text-faint mt-0.5">
              {enabledCount} of 3 enabled
            </p>
          </div>

          {TAB_OPTIONS.map(({ key, label, Icon }) => {
            const checked = views[key];
            const saving = savingKey === key;
            return (
              <button
                key={key}
                onClick={() => toggleView(key)}
                disabled={saving}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-prose hover:bg-surface transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className={checked ? 'text-teal' : 'text-faint'} />
                  {label}
                </span>
                {saving ? (
                  <Loader2 size={14} className="animate-spin text-faint" />
                ) : (
                  <span
                    className={`relative w-8 h-[18px] rounded-full transition-colors ${
                      checked ? 'bg-teal' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${
                        checked ? 'left-[16px]' : 'left-[2px]'
                      }`}
                    />
                  </span>
                )}
              </button>
            );
          })}

          <div className="border-t border-edge my-1.5" />

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-prose hover:bg-surface transition-colors"
          >
            <ExternalLink size={14} />
            Open Preview
          </a>
          <button
            onClick={async () => { await copyUrl(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-prose hover:bg-surface transition-colors"
          >
            <Share2 size={14} />
            Copy share link
          </button>
        </div>
      )}
    </div>
  );
}
