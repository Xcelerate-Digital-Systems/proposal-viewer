// components/admin/ads/swipe/SwipeFileCard.tsx
'use client';

import type { SwipeFile } from '@/lib/supabase';
import SwipeMetaMockup from './SwipeMetaMockup';

type Props = {
  file: SwipeFile;
  /** Called after the link is copied so the parent can persist has_been_shared. */
  onShared: () => Promise<void>;
};

export default function SwipeFileCard({ file, onShared }: Props) {
  const handleShare = async () => {
    const url = `${window.location.origin}/swipe/${file.share_token}`;
    await navigator.clipboard.writeText(url);
    await onShared();
  };

  return (
    <div className="flex flex-col gap-2">
      <SwipeMetaMockup file={file} compact onShare={handleShare} />

      {file.tags && file.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {file.tags.map((t) => (
            <span key={t} className="text-2xs bg-teal/10 text-teal px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
