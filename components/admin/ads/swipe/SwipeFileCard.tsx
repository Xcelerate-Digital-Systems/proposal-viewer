// components/admin/ads/swipe/SwipeFileCard.tsx
'use client';

import { useState } from 'react';
import { ExternalLink, Share2, Check } from 'lucide-react';
import type { SwipeFile } from '@/lib/supabase';
import SwipeMetaMockup from './SwipeMetaMockup';

type Props = {
  file: SwipeFile;
  /** Called after the link is copied so the parent can persist has_been_shared. */
  onShared: () => Promise<void>;
};

export default function SwipeFileCard({ file, onShared }: Props) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSharing(true);
    try {
      const url = `${window.location.origin}/swipe/${file.share_token}`;
      await navigator.clipboard.writeText(url);
      await onShared();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <SwipeMetaMockup file={file} compact />

      {file.tags && file.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {file.tags.map((t) => (
            <span key={t} className="text-[10px] bg-teal/10 text-teal px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 px-1">
        <button
          onClick={handleShare}
          disabled={sharing}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium ${
            copied ? 'text-teal' : 'text-muted hover:text-ink hover:bg-surface'
          }`}
          title="Copy share link"
        >
          {copied ? <Check size={12} /> : <Share2 size={12} />}
          {copied ? 'Copied!' : 'Share'}
        </button>
        {file.source_url && (
          <a
            href={file.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-muted hover:text-ink hover:bg-surface"
            title="Open source"
          >
            <ExternalLink size={12} /> Source
          </a>
        )}
      </div>
    </div>
  );
}
