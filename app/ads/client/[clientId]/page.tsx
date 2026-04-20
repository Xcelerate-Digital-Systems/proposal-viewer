// app/ads/client/[clientId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Search, Filter, Share2, Upload } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/lib/supabase';
import { useAdCreatives, type AdCreativeFilters } from '@/hooks/useAdCreatives';
import { useAdTrackerContext } from '@/components/admin/ads/AdTrackerContext';
import AdCreativesTable from '@/components/admin/ads/AdCreativesTable';
import QuickCreateModal from '@/components/admin/ads/QuickCreateModal';
import AdBulkUploadModal from '@/components/admin/ads/AdBulkUploadModal';
import AdFilterBar from '@/components/admin/ads/AdFilterBar';
import ClientShareModal from '@/components/admin/ads/ClientShareModal';
import type { AdAccountStandards } from '@/lib/types/ads';

type Client = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  ad_tracker_share_token: string | null;
};

export default function ClientAdsPage() {
  return (
    <AdminLayout>
      {(auth) => <ClientAdsView companyId={auth.companyId!} />}
    </AdminLayout>
  );
}

function ClientAdsView({ companyId }: { companyId: string }) {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const { trackers, createTracker, fetchTrackers } = useAdTrackerContext();

  const [client, setClient] = useState<Client | null>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [accountStandards, setAccountStandards] = useState<AdAccountStandards | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState<AdCreativeFilters>({
    client_id: clientId,
    sort_by: 'sort_order',
    sort_dir: 'asc',
  });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, client_id: clientId }));
  }, [clientId]);

  // Client fetch
  const fetchClient = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setClientLoading(false); return; }

    const res = await fetch(`/api/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      setClientError(json.error || 'Failed to load client');
      setClientLoading(false);
      return;
    }
    setClient(json);
    setClientLoading(false);
  }, [clientId]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  const activeFilters = useMemo(
    () => ({ ...filters, search: searchQuery || undefined }),
    [filters, searchQuery]
  );

  const {
    creatives, pagination, loading,
    createCreative, updateCreative, deleteCreative, fetchCreatives,
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

  useEffect(() => { fetchAccountStandards(); }, [fetchAccountStandards]);

  // Trackers that belong to this client — used to pick one for new ads and
  // for merging standards when rendering metrics.
  const clientTrackers = useMemo(
    () => trackers.filter((t) => t.client_id === clientId),
    [trackers, clientId]
  );

  // Primary tracker = most recent tracker for this client; serves as the
  // default target for new ads. If none exists, one is created on first ad.
  const primaryTracker = clientTrackers[0] || null;

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      sort_dir: prev.sort_by === column && prev.sort_dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const resolveTargetTrackerId = async (): Promise<string | null> => {
    if (primaryTracker) return primaryTracker.id;
    if (!client) return null;
    const { data, error } = await createTracker({
      name: client.name,
      client_id: client.id,
      client_name: client.name,
    });
    if (error || !data) return null;
    return data.id;
  };

  const handleNewAd = async (data: Record<string, unknown>) => {
    const trackerId = await resolveTargetTrackerId();
    if (!trackerId) return { error: 'Failed to create tracker' };
    const result = await createCreative({ ...data, tracker_id: trackerId });
    if (!result.error) {
      setShowQuickCreate(false);
      fetchTrackers();
    }
    return result;
  };

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted">{clientError || 'Client not found'}</p>
        <button onClick={() => router.push('/ads')} className="text-sm text-teal hover:underline">
          Back to Ad Tracker
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-edge bg-white px-6 lg:px-10 py-5">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-ink truncate">{client.name}</h1>
            <p className="text-sm text-muted mt-0.5">
              {pagination.total} ad{pagination.total !== 1 ? 's' : ''}
              {clientTrackers.length > 0 && ` · ${clientTrackers.length} tracker${clientTrackers.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-surface rounded-[10px] px-3.5 py-2 w-[240px] focus-within:ring-2 focus-within:ring-teal/20 transition-all">
              <Search size={16} className="text-faint shrink-0" />
              <input
                type="text"
                placeholder="Search ads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[13px] text-ink placeholder-faint outline-none w-full"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-all ${
                showFilters ? 'bg-teal text-white' : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              <Filter size={16} />
            </button>

            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-2 bg-white border border-edge hover:border-teal/40 text-ink text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Share2 size={16} />
              Share
            </button>

            {primaryTracker && (
              <button
                onClick={() => setShowBulkUpload(true)}
                className="flex items-center gap-2 bg-white border border-edge hover:border-teal/40 text-ink text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
              >
                <Upload size={16} />
                Bulk Upload
              </button>
            )}

            <button
              onClick={() => setShowQuickCreate(true)}
              className="flex items-center gap-2 bg-teal hover:bg-teal-hover text-white text-[13px] font-semibold rounded-[10px] px-4 py-2.5 transition-colors"
            >
              <Plus size={16} />
              New Ad
            </button>
          </div>
        </div>

        {showFilters && (
          <AdFilterBar
            filters={filters}
            onChange={(f) => setFilters({ ...filters, ...f })}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden overflow-y-auto">
        <AdCreativesTable
          creatives={creatives}
          loading={loading}
          sortBy={filters.sort_by || 'sort_order'}
          sortDir={filters.sort_dir || 'asc'}
          companyId={companyId}
          onSort={handleSort}
          onEdit={(id) => {
            const creative = creatives.find((c) => c.id === id);
            if (!creative) return;
            const sortBy = filters.sort_by || 'sort_order';
            const sortDir = filters.sort_dir || 'asc';
            router.push(`/ads/${creative.tracker_id}/${id}?sort=${sortBy}&dir=${sortDir}`);
          }}
          onDelete={deleteCreative}
          accountStandards={accountStandards}
          trackerStandards={primaryTracker?.standards || {}}
        />
      </div>

      {/* Bulk upload modal — only usable once a primary tracker exists */}
      {showBulkUpload && primaryTracker && (
        <AdBulkUploadModal
          trackerId={primaryTracker.id}
          companyId={companyId}
          createCreative={createCreative as (data: Record<string, unknown>) => Promise<{ data?: { id: string }; error?: string }>}
          updateCreative={updateCreative}
          onClose={() => setShowBulkUpload(false)}
          onComplete={fetchCreatives}
        />
      )}

      {showQuickCreate && (
        <QuickCreateModal
          onClose={() => setShowQuickCreate(false)}
          onCreate={handleNewAd}
        />
      )}

      {showShare && (
        <ClientShareModal
          clientId={client.id}
          clientName={client.name}
          initialToken={client.ad_tracker_share_token}
          onClose={() => setShowShare(false)}
          onTokenChange={(token) => setClient((prev) => prev && { ...prev, ad_tracker_share_token: token })}
        />
      )}
    </div>
  );
}
