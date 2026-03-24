// app/ads/[trackerId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, ArrowLeft, Search, Filter, BookOpen, Pencil, Check, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdCreatives, type AdCreativeFilters } from '@/hooks/useAdCreatives';
import { supabase, type AdTracker } from '@/lib/supabase';
import AdCreativesTable from '@/components/admin/ads/AdCreativesTable';
import QuickCreateModal from '@/components/admin/ads/QuickCreateModal';
import AdFilterBar from '@/components/admin/ads/AdFilterBar';
import NamingLegendPanel from '@/components/admin/ads/NamingLegendPanel';
import ReferenceTabContent from '@/components/admin/ads/ReferenceTabContent';
import type { TabType } from '@/components/admin/ads/ReferenceTabContent';
import StandardsTab from '@/components/admin/ads/StandardsTab';
import TargetMarketsTab from '@/components/admin/ads/TargetMarketsTab';
import type { AdAccountStandards, TrackerStandards } from '@/lib/types/ads';

type TrackerTab = 'creatives' | 'standards' | 'target_markets' | TabType;

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
  const trackerId = params.trackerId as string;

  const [tracker, setTracker] = useState<AdTracker | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(true);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showNamingLegend, setShowNamingLegend] = useState(false);
  const [accountStandards, setAccountStandards] = useState<AdAccountStandards | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TrackerTab>('creatives');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<AdCreativeFilters>({
    tracker_id: trackerId,
    sort_by: 'sort_order',
    sort_dir: 'asc',
  });

  // Merge search into filters with debounce
  const activeFilters = useMemo(
    () => ({ ...filters, search: searchQuery || undefined }),
    [filters, searchQuery]
  );

  const {
    creatives, pagination, loading,
    fetchCreatives, createCreative, updateCreative, deleteCreative,
  } = useAdCreatives(companyId, activeFilters);

  // Fetch tracker info
  const fetchTracker = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    const res = await fetch(`/api/ads/trackers/${trackerId}?company_id=${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) setTracker(json.data);
    setTrackerLoading(false);
  }, [trackerId, companyId]);

  // Fetch account standards
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
    fetchTracker();
    fetchAccountStandards();
  }, [fetchTracker, fetchAccountStandards]);

  const startEditingName = () => {
    setNameValue(tracker?.name ?? '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  };

  const cancelEditingName = () => {
    setEditingName(false);
    setNameValue('');
  };

  const saveTrackerName = async () => {
    if (!nameValue.trim() || nameValue.trim() === tracker?.name) {
      cancelEditingName();
      return;
    }
    setNameSaving(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (token) {
      const res = await fetch(`/api/ads/trackers/${trackerId}?company_id=${companyId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      const json = await res.json();
      if (json.success) setTracker(json.data);
    }
    setNameSaving(false);
    setEditingName(false);
  };

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      sort_dir: prev.sort_by === column && prev.sort_dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (trackerLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (!tracker) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted">Tracker not found</p>
        <button onClick={() => router.push('/ads')} className="text-sm text-teal hover:underline">
          Back to trackers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-white px-6 lg:px-10 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/ads')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTrackerName();
                    if (e.key === 'Escape') cancelEditingName();
                  }}
                  className="text-xl font-semibold text-ink bg-surface border border-edge rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-teal/30 min-w-0 w-full max-w-sm"
                  disabled={nameSaving}
                  autoFocus
                />
                <button
                  onClick={saveTrackerName}
                  disabled={nameSaving}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-teal hover:bg-teal/10 transition-colors shrink-0"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={cancelEditingName}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface transition-colors shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditingName}
                className="group flex items-center gap-1.5 text-left"
                title="Edit campaign name"
              >
                <h1 className="text-xl font-semibold text-ink truncate">{tracker.name}</h1>
                <Pencil size={14} className="text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </button>
            )}
            <p className="text-sm text-muted mt-0.5">
              {pagination.total} creative{pagination.total !== 1 ? 's' : ''}
              {tracker.client_name && ` · ${tracker.client_name}`}
              {tracker.description && ` · ${tracker.description}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-surface rounded-[10px] px-3.5 py-2.5 w-[200px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
              <Search size={16} className="text-faint shrink-0" />
              <input
                type="text"
                placeholder="Search ads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
              />
            </div>

            {/* Naming Legend */}
            <button
              onClick={() => setShowNamingLegend(true)}
              className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-surface text-muted hover:text-ink transition-all"
              title="Ad Naming Convention"
            >
              <BookOpen size={16} />
            </button>

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

        {/* Filter bar */}
        {showFilters && activeTab === 'creatives' && (
          <AdFilterBar
            filters={filters}
            onChange={(f) => setFilters({ ...filters, ...f })}
          />
        )}

        {/* Tab navigation */}
        <div className="flex items-center gap-1 mt-4 -mb-[1px]">
          {([
            { key: 'creatives', label: 'Creatives' },
            { key: 'standards', label: 'Standards' },
            { key: 'target_markets', label: 'Target Markets' },
            { key: 'angles', label: 'Angles Menu' },
            { key: 'formats', label: 'Creative Formats' },
            { key: 'awareness', label: 'Awareness Level' },
            { key: 'sophistication', label: 'Market Sophistication' },
          ] as { key: TrackerTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-[13px] font-medium rounded-t-lg border border-b-0 transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-ink border-edge'
                  : 'bg-transparent text-muted border-transparent hover:text-ink hover:bg-surface/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden overflow-y-auto">
        {activeTab === 'creatives' ? (
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
            trackerStandards={tracker?.standards || {}}
          />
        ) : activeTab === 'standards' ? (
          <StandardsTab
            trackerId={trackerId}
            companyId={companyId}
            trackerStandards={tracker?.standards || {}}
            onSaveTracker={async (standards) => {
              const token = (await supabase.auth.getSession()).data.session?.access_token;
              if (!token) return;
              await fetch(`/api/ads/trackers/${trackerId}?company_id=${companyId}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ standards }),
              });
              setTracker({ ...tracker!, standards });
              fetchAccountStandards();
            }}
          />
        ) : activeTab === 'target_markets' ? (
          <TargetMarketsTab companyId={companyId} />
        ) : (
          <ReferenceTabContent type={activeTab} />
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

      {/* Naming legend panel */}
      {showNamingLegend && (
        <NamingLegendPanel onClose={() => setShowNamingLegend(false)} />
      )}

    </div>
  );
}
