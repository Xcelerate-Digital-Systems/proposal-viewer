// components/reviews/ShareButton.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Share2, Copy, Check, ExternalLink, Link2Off, Loader2, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

/* ─── Types ────────────────────────────────────────────────────── */

interface ShareButtonProps {
  /** Current share token — null means not yet shared */
  token: string | null;

  /** Which view this button controls */
  view: 'items' | 'board' | 'item';

  /** Project ID (needed for the share API call) */
  projectId: string;

  /** Item ID (required when view === 'item') */
  itemId?: string;

  /** Build the public URL from a token */
  buildUrl: (token: string) => string;

  /** Label shown on the button */
  label?: string;

  /** Callback after token changes (so parent can update state) */
  onTokenChange?: (token: string | null) => void;
}

/* ─── Component ────────────────────────────────────────────────── */

export default function ShareButton({
  token,
  view,
  projectId,
  itemId,
  buildUrl,
  label = 'Share',
  onTokenChange,
}: ShareButtonProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = !!token;

  // Close menu on outside click
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

  // Get auth token from existing session
  const getAuthToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  // Copy URL to clipboard
  const copyUrl = useCallback(async (t: string) => {
    const url = buildUrl(t);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Share link copied!');
  }, [buildUrl, toast]);

  // Main button click — generate if needed, then copy
  const handleClick = useCallback(async () => {
    // If token already exists, just copy
    if (token) {
      await copyUrl(token);
      return;
    }

    // Generate a new token
    setLoading(true);
    try {
      const authToken = await getAuthToken();
      if (!authToken) { toast.error('Not authenticated'); return; }

      const res = await fetch(`/api/reviews/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ view, action: 'generate', itemId }),
      });

      if (!res.ok) { toast.error('Failed to generate share link'); return; }

      const data = await res.json();
      const newToken = data.token;
      onTokenChange?.(newToken);
      await copyUrl(newToken);
    } catch {
      toast.error('Failed to generate share link');
    } finally {
      setLoading(false);
    }
  }, [token, projectId, view, itemId, getAuthToken, copyUrl, onTokenChange, toast]);

  // Revoke token
  const handleRevoke = useCallback(async () => {
    setLoading(true);
    setMenuOpen(false);
    try {
      const authToken = await getAuthToken();
      if (!authToken) { toast.error('Not authenticated'); return; }

      const res = await fetch(`/api/reviews/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ view, action: 'revoke', itemId }),
      });

      if (!res.ok) { toast.error('Failed to revoke share link'); return; }

      onTokenChange?.(null);
      toast.info('Share link revoked');
    } catch {
      toast.error('Failed to revoke share link');
    } finally {
      setLoading(false);
    }
  }, [projectId, view, itemId, getAuthToken, onTokenChange, toast]);

  return (
    <div className="relative inline-flex" ref={menuRef}>
      {/* Main button — always copies link (generates first if needed) */}
      <button
        onClick={handleClick}
        disabled={loading}
        className={`
          flex items-center gap-1.5 px-3 py-2 text-sm font-medium border transition-colors
          ${isActive
            ? 'text-teal border-teal/30 bg-teal/5 hover:bg-teal/10'
            : 'text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-100'}
          ${isActive ? 'rounded-l-lg border-r-0' : 'rounded-lg'}
        `}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : copied ? (
          <Check size={14} className="text-emerald-500" />
        ) : isActive ? (
          <Copy size={14} />
        ) : (
          <Share2 size={14} />
        )}
        {copied ? 'Copied!' : label}
      </button>

      {/* Dropdown chevron — only when token exists */}
      {isActive && (
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center px-1.5 py-2 rounded-r-lg border border-teal/30 bg-teal/5 hover:bg-teal/10 text-teal transition-colors"
        >
          <ChevronDown size={12} />
        </button>
      )}

      {/* Dropdown menu */}
      {menuOpen && isActive && token && (
        <div className="fixed z-[9999] bg-white rounded-xl border border-gray-200 shadow-lg w-[200px] py-1"
          style={{
            top: (menuRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: Math.min(
              menuRef.current?.getBoundingClientRect().right ?? 0,
              window.innerWidth - 210
            ) - 200,
          }}
        >
          <a
            href={buildUrl(token)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={14} />
            Open Preview
          </a>

          <div className="border-t border-gray-100 my-1" />

          <button
            onClick={handleRevoke}
            disabled={loading}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2Off size={14} />}
            Revoke Link
          </button>
        </div>
      )}
    </div>
  );
}