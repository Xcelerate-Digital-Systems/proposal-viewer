// components/reviews/ShareItemButton.tsx
'use client';

import { useState, useCallback } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { buildReviewItemUrl } from '@/lib/proposal-url';

/* ─── Types ────────────────────────────────────────────────────── */

interface ShareItemButtonProps {
  /** The review project ID */
  projectId: string;

  /** The review item ID */
  itemId: string;

  /** Current share token for this item — null means not shared */
  shareToken: string | null;

  /** Custom domain for URL building */
  customDomain?: string | null;

  /** Callback when token changes */
  onTokenChange?: (token: string | null) => void;

  /** Size variant */
  size?: 'sm' | 'md';
}

/* ─── Component ────────────────────────────────────────────────── */

/**
 * Compact share button for individual review items.
 *
 * Click generates a share token (if not exists) and copies the
 * /review/[token] URL to clipboard. The token resolves to a
 * single-item detail view.
 */
export default function ShareItemButton({
  projectId,
  itemId,
  shareToken,
  customDomain,
  onTokenChange,
  size = 'sm',
}: ShareItemButtonProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger parent click handlers (e.g. card click)
    setLoading(true);

    try {
      // If already have a token, just copy the URL
      if (shareToken) {
        const url = buildReviewItemUrl(shareToken, customDomain, window.location.origin);
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Item link copied!');
        setLoading(false);
        return;
      }

      // Generate a new token
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData.session?.access_token;
      if (!authToken) { toast.error('Not authenticated'); setLoading(false); return; }

      const res = await fetch(`/api/reviews/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ view: 'item', action: 'generate', itemId }),
      });

      if (!res.ok) { toast.error('Failed to generate share link'); setLoading(false); return; }

      const data = await res.json();
      const newToken = data.token;
      onTokenChange?.(newToken);

      // Copy URL
      const url = buildReviewItemUrl(newToken, customDomain, window.location.origin);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Item link copied!');
    } catch {
      toast.error('Failed to share item');
    } finally {
      setLoading(false);
    }
  }, [projectId, itemId, shareToken, customDomain, onTokenChange, toast]);

  const isSmall = size === 'sm';

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={shareToken ? 'Copy item link' : 'Share this item'}
      className={`
        flex items-center gap-1 rounded-lg font-medium border transition-colors
        ${shareToken
          ? 'text-[#017C87] border-[#017C87]/30 bg-[#017C87]/5 hover:bg-[#017C87]/10'
          : 'text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'}
        ${isSmall ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'}
      `}
    >
      {loading ? (
        <Loader2 size={isSmall ? 10 : 12} className="animate-spin" />
      ) : copied ? (
        <Check size={isSmall ? 10 : 12} className="text-emerald-500" />
      ) : (
        <Share2 size={isSmall ? 10 : 12} />
      )}
      {!isSmall && (copied ? 'Copied!' : shareToken ? 'Copy Link' : 'Share')}
    </button>
  );
}