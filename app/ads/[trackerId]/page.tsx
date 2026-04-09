// app/ads/[trackerId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, ArrowLeft } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdCreatives, type AdCreativeFilters } from '@/hooks/useAdCreatives';
import { supabase } from '@/lib/supabase';
import AdCreativesTable from '@/components/admin/ads/AdCreativesTable';
import QuickCreateModal from '@/components/admin/ads/QuickCreateModal';
import AdFilterBar from '@/components/admin/ads/AdFilterBar';
import ReferenceTabContent from '@/components/admin/ads/ReferenceTabContent';
import type { TabType } from '@/components/admin/ads/ReferenceTabContent';
import StandardsTab from '@/components/admin/ads/StandardsTab';
import TargetMarketsTab from '@/components/admin/ads/TargetMarketsTab';
import { useAdTrackerContext } from '@/components/admin/ads/AdTrackerContext';
import type { AdAccountStandards } from '@/lib/types/ads';

type PanelTab = 'standards' | 'target_markets' | TabType;

const PANEL_LABELS: Record<PanelTab, string> = {
  standards: 'Standards',
  target_markets: 'Target Markets',
  angles: 'Angles Menu',
  formats: 'Creative Formats',
  awareness: 'Awareness Level',
  sophistication: 'Market Sophistication',
};

const VALID_PANELS = new Set<PanelTab>([
  'standards', 'target_markets', 'angles', 'formats', 'awareness', 'sophistication',
]);

export default function TrackerDetailPage() {
  return (
    <AdminLayout>
      {(auth) => <TrackerDetail companyId={auth.companyId!} />}
    </AdminLayout>
  );
}

function TrackerDetail({ companyId }: { companyId: string }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const trackerId = params.trackerId as string;

  const panelParam = searchParams?.get('panel');
  const activePanel: PanelTab | null =
    panelParam && VALID_PANELS.has(panelParam as PanelTab) ? (panelParam as PanelTab) : null;

  const { trackers, loading: trackersLoading, fetchTrackers } = useAdTrackerContext();
  const tracker = trackers.find((t) => t.id === trackerId);

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [accountStandards, setAccountStandards] = useState<AdAccountStandards | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState<AdCreativeFilters>({
    tracker_id: trackerId,
    sort_by: 'sort_order',
    sort_dir: 'asc',
  });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, tracker_id: trackerId }));
  }, [trackerId]);

  const clearPanel = () => router.push(`/ads/${trackerId}`);

  const activeFilters = useMemo(
    () => ({ ...filters, search: searchQuery || undefined }),
    [filters, searchQuery]
  );

  const {
    creatives, pagination, loading,
    createCreative, deleteCreative,
  } = useAdCreatives(companyId, activeFilters);

  const fetchAccountStandards = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/ads/standards?company_id=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) setAccountStandards(json.data);
  }, [companyId]);

  useEffect(() => {
    fetchAccountStandards();
  }, [fetchAccountStandards]);

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      sort_dir: prev.sort_by === column && prev.sort_dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (trackersLoading && !tracker) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (!tracker) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted">Campaign not found</p>
        <button onClick={() => router.push('/ads')} className="text-sm text-teal hover:underline">
          Back to Ad Tracker
        </button>
      </div>
    );
  }

  const activePanelLabel = activePanel ? PANEL_LABELS[activePanel] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-white px-6 lg:px-10 py-5">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-ink truncate">{tracker.name}</h1>
            <p className="text-sm text-muted mt-0.5">
              {pagination.total} creative{pagination.total !== 1 ? 's' : ''}
              {tracker.client_name && ` · ${tracker.client_name}`}
              {tracker.description && ` · ${tracker.description}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-all ${
                showFilters
                  ? 'bg-teal text-white'
                  : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              <Filter size={16} />
            </button>

            {/* New creative */}
            <button
              onClick={() => setShowQuickCreate(true)}
              className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Plus size={16} />
              New Creative
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1" />

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-surface rounded-[10px] px-3.5 py-2 w-[220px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search ads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
            />
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && !activePanel && (
          <AdFilterBar
            filters={filters}
            onChange={(f) => setFilters({ ...filters, ...f })}
          />
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden overflow-y-auto">
        {activePanel ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-6 lg:px-10 py-4 border-b border-edge bg-ivory">
              <button
                onClick={clearPanel}
                className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink transition-colors"
              >
                <ArrowLeft size={15} />
                Back to Creatives
              </button>
              <div className="w-px h-4 bg-edge" />
              <h2 className="text-[14px] font-semibold text-ink">{activePanelLabel}</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activePanel === 'standards' ? (
                <StandardsTab
                  trackerId={trackerId}
                  companyId={companyId}
                  trackerStandards={tracker.standards || {}}
                  onSaveTracker={async (standards) => {
                    const token = (await supabase.auth.getSession()).data.session?.access_token;
                    if (!token) return;
                    await fetch(`/api/ads/trackers/${trackerId}?company_id=${companyId}`, {
                      method: 'PATCH',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ standards }),
                    });
                    fetchTrackers();
                    fetchAccountStandards();
                  }}
                />
              ) : activePanel === 'target_markets' ? (
                <TargetMarketsTab companyId={companyId} trackerId={trackerId} />
              ) : (
                <ReferenceTabContent type={activePanel} />
              )}
            </div>
          </div>
        ) : (
          <AdCreativesTable
            creatives={creatives}
            loading={loading}
            sortBy={filters.sort_by || 'sort_order'}
            sortDir={filters.sort_dir || 'asc'}
            companyId={companyId}
            onSort={handleSort}
            onEdit={(id) => router.push(`/ads/${trackerId}/${id}`)}
            onDelete={deleteCreative}
            accountStandards={accountStandards}
            trackerStandards={tracker.standards || {}}
          />
        )}
      </div>

      {/* Quick create modal */}
      {showQuickCreate && (
        <QuickCreateModal
          onClose={() => setShowQuickCreate(false)}
          onCreate={async (data) => {
            const result = await createCreative({ ...data, tracker_id: trackerId });
            if (!result.error) setShowQuickCreate(false);
            return result;
          }}
        />
      )}
    </div>
  );
}
