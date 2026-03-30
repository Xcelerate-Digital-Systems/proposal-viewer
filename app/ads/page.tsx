// app/ads/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Megaphone, Search, LayoutGrid, List } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdTrackers } from '@/hooks/useAdTrackers';
import AdTrackerCard from '@/components/admin/ads/AdTrackerCard';
import CreateTrackerModal from '@/components/admin/ads/CreateTrackerModal';

export default function AdsPage() {
  return (
    <AdminLayout>
      {(auth) => <AdsContent companyId={auth.companyId!} />}
    </AdminLayout>
  );
}

function AdsContent({ companyId }: { companyId: string }) {
  const router = useRouter();
  const { trackers, loading, createTracker, deleteTracker } = useAdTrackers(companyId);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agencyviz-ads-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('agencyviz-ads-view', mode);
  };

  const filtered = searchQuery
    ? trackers.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : trackers;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-ivory px-6 lg:px-10 py-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-ink">Ad Tracker</h1>
            <p className="text-sm text-muted mt-1">
              {trackers.length} campaign{trackers.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-surface rounded-[10px] p-1 gap-0.5">
              <button
                onClick={() => toggleView('grid')}
                className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => toggleView('list')}
                className={`w-[34px] h-[30px] rounded-lg flex items-center justify-center transition-all ${
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-faint hover:text-muted'
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-surface rounded-[10px] px-3.5 py-2.5 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
              <Search size={16} className="text-faint shrink-0" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
              />
            </div>

            {/* New tracker */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Plus size={16} />
              New Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        {showCreate && (
          <CreateTrackerModal
            onClose={() => setShowCreate(false)}
            onCreate={async (data) => {
              const result = await createTracker(data);
              if (!result.error) setShowCreate(false);
              return result;
            }}
            existingClients={Array.from(new Set(trackers.map((t) => t.client_name).filter(Boolean) as string[]))}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 && searchQuery ? (
          <div className="text-center py-20">
            <Search size={28} className="text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">
              No campaigns matching &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : trackers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Megaphone size={28} className="text-faint" />
            </div>
            <h3 className="text-lg font-semibold text-muted mb-1">No campaigns yet</h3>
            <p className="text-sm text-faint">
              Create a campaign to start cataloguing and monitoring your ad creatives
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Plus size={16} />
              New Campaign
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((tracker) => (
              <AdTrackerCard
                key={tracker.id}
                tracker={tracker}
                onClick={() => router.push(`/ads/${tracker.id}`)}
                onDelete={() => deleteTracker(tracker.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tracker) => (
              <div
                key={tracker.id}
                onClick={() => router.push(`/ads/${tracker.id}`)}
                className="flex items-center gap-4 bg-white border border-edge rounded-xl px-5 py-4 hover:border-teal/30 cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                  <Megaphone size={18} className="text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-ink truncate">{tracker.name}</h3>
                  {(tracker.client_name || tracker.description) && (
                    <p className="text-xs text-faint truncate mt-0.5">
                      {[tracker.client_name, tracker.description].filter(Boolean).join(' \u00B7 ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted whitespace-nowrap">
                  {tracker.creative_count} creative{tracker.creative_count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
