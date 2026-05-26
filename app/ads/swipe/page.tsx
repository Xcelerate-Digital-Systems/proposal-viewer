// app/ads/swipe/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useSwipeFileContext } from '@/components/admin/ads/swipe/SwipeFileContext';

export default function SwipeFileIndexPage() {
  return (
    <AdminLayout>
      {() => <SwipeFileIndexContent />}
    </AdminLayout>
  );
}

function SwipeFileIndexContent() {
  const swipe = useSwipeFileContext();
  const router = useRouter();

  // As soon as types are loaded, jump to the first one.
  useEffect(() => {
    if (!swipe.loading && swipe.types.length > 0) {
      router.replace(`/ads/swipe/${swipe.types[0].id}`);
    }
  }, [swipe.loading, swipe.types, router]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <Bookmark size={32} className="text-faint mb-3" />
      <h2 className="text-lg font-semibold text-ink mb-1">Swipe Vault</h2>
      <p className="text-sm text-muted max-w-sm">
        {swipe.loading
          ? 'Loading your ad types…'
          : 'Create an ad type in the sidebar to start saving swipes.'}
      </p>
    </div>
  );
}
