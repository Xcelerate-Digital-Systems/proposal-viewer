// app/swipe/[token]/SwipePublicView.tsx
'use client';

import type { PublicSwipePayload } from '@/lib/types/swipe-files';
import SwipeFileDetailModal from '@/components/admin/ads/swipe/SwipeFileDetailModal';

/**
 * Public share view. Reuses the admin detail modal in read-only mode so
 * recipients see exactly the same layout as the share sender does.
 */
export default function SwipePublicView({ payload }: { payload: PublicSwipePayload }) {
  if (payload.mode !== 'file') {
    // Type-level share tokens aren't supported anymore — only individual swipes.
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#f0f2f5] p-6">
        <p className="text-sm text-[#65676b]">This share link is no longer available.</p>
      </div>
    );
  }

  return (
    <SwipeFileDetailModal
      files={[payload.file]}
      currentIndex={0}
      onNavigate={() => {}}
      onClose={() => {
        if (typeof window !== 'undefined') window.close();
      }}
      onEdit={() => {}}
      onDelete={async () => {}}
      onShared={async () => {}}
      readOnly
    />
  );
}
