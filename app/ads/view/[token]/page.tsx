// app/ads/view/[token]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Megaphone, Sparkles } from 'lucide-react';
import AdCreativesTable from '@/components/admin/ads/AdCreativesTable';
import type { ClientAdTrackerSharePayload } from '@/lib/types/ads';

export default function PublicAdTrackerViewer({ params }: { params: { token: string } }) {
  const [payload, setPayload] = useState<ClientAdTrackerSharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sortBy, setSortBy] = useState('sort_order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/ads/share/${params.token}`);
      if (cancelled) return;
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setPayload(json);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-surface">
            <Megaphone size={28} className="text-faint" />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Ad tracker not found</h2>
          <p className="text-sm text-muted">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  // Sort creatives client-side
  const sortedCreatives = [...payload.creatives].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortBy];
    const bv = (b as Record<string, unknown>)[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const primaryTrackerStandards = payload.trackers[0]?.standards || {};

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      {/* Header */}
      <header className="border-b border-edge bg-white px-6 lg:px-10 py-5">
        <div className="flex items-center justify-between gap-4 max-w-[2000px] mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            {payload.client.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={payload.client.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                <Building2 size={18} className="text-faint" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-ink truncate">{payload.client.name}</h1>
              <p className="text-[12px] text-muted">
                Ad tracker · {payload.creatives.length} ad{payload.creatives.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <Link
            href={`/ads/view/${params.token}/ai`}
            className="flex items-center gap-2 bg-white border border-edge hover:border-teal/40 text-ink text-[13px] font-medium rounded-[10px] px-3.5 py-2 transition-colors"
          >
            <Sparkles size={14} className="text-teal" />
            AI view
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden">
        {payload.creatives.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-16">
            <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center">
              <Megaphone size={24} className="text-faint" />
            </div>
            <p className="text-sm text-muted">No ads yet</p>
          </div>
        ) : (
          <AdCreativesTable
            creatives={sortedCreatives}
            loading={false}
            sortBy={sortBy}
            sortDir={sortDir}
            companyId=""
            onSort={handleSort}
            accountStandards={payload.account_standards}
            trackerStandards={primaryTrackerStandards}
            readOnly
          />
        )}
      </main>
    </div>
  );
}
