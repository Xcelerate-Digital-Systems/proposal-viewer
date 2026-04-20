// app/ads/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdTrackerContext } from '@/components/admin/ads/AdTrackerContext';
import CreateTrackerModal from '@/components/admin/ads/CreateTrackerModal';

export default function AdsPage() {
  return (
    <AdminLayout>
      {() => <AdsIndex />}
    </AdminLayout>
  );
}

function AdsIndex() {
  const router = useRouter();
  const { trackers, loading, createTracker } = useAdTrackerContext();
  const [showCreate, setShowCreate] = useState(false);
  const didRedirectRef = useRef(false);

  // Auto-redirect to first client ONCE on initial load. Guarded so the effect
  // doesn't re-fire when the list changes (e.g. after creating a new client).
  useEffect(() => {
    if (didRedirectRef.current) return;
    if (!loading && trackers.length > 0) {
      didRedirectRef.current = true;
      router.replace(`/ads/${trackers[0].id}`);
    }
  }, [loading, trackers, router]);

  if (loading || trackers.length > 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
        <Building2 size={28} className="text-faint" />
      </div>
      <h3 className="text-lg font-semibold text-muted mb-1">No clients yet</h3>
      <p className="text-sm text-faint max-w-sm">
        Create a client to start tracking their ads, decisions, and game plan.
      </p>
      <button
        onClick={() => setShowCreate(true)}
        className="mt-4 inline-flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
      >
        <Plus size={16} />
        New Client
      </button>

      {showCreate && (
        <CreateTrackerModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            const result = await createTracker(data);
            if (!result.error && result.data) {
              setShowCreate(false);
              router.replace(`/ads/${result.data.id}`);
            }
            return result;
          }}
        />
      )}
    </div>
  );
}
