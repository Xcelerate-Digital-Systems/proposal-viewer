// components/admin/ads/swipe/SwipeFileCard.tsx
'use client';

import { Share2 } from 'lucide-react';
import type { SwipeFile } from '@/lib/supabase';
import { buildSwipeUrl } from '@/lib/proposal-url';
import SwipeMetaMockup from './SwipeMetaMockup';

type Props = {
  file: SwipeFile;
  customDomain?: string | null;
  onShared: () => Promise<void>;
};

export default function SwipeFileCard({ file, customDomain, onShared }: Props) {
  const handleShare = async () => {
    const url = buildSwipeUrl(file.share_token, customDomain, window.location.origin);
    await navigator.clipboard.writeText(url);
    await onShared();
  };

  return (
    <div className="flex flex-col gap-2">
      <SwipeMetaMockup file={file} compact onShare={handleShare} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {file.has_been_shared && (
          <span className="inline-flex items-center gap-1 text-2xs text-muted" title="Shared via link">
            <Share2 size={10} />
          </span>
        )}
        {file.tags?.map((t) => (
          <span key={t} className="text-2xs bg-teal/10 text-teal px-2 py-0.5 rounded-full">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
