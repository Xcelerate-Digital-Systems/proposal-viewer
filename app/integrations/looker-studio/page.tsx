// app/integrations/looker-studio/page.tsx
//
// Integration hub. Each integration is rendered as a self-contained card with
// the dashboard's two-tier section pattern: shadow-card surface, header band
// with brand tile, then Step 1 / Step 2 sub-sections inside. The page is just
// a vertical stack of these cards.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Workflow } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/ui/PageHeader';
import MetaConnectorCard from '@/components/admin/connectors/MetaConnectorCard';

function Banners() {
  const search = useSearchParams();
  const connected = search.get('connected') === '1';
  const error = search.get('error');
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss the connected banner after a short window so it doesn't
  // linger the next time the user revisits this URL.
  useEffect(() => {
    if (connected) {
      const t = setTimeout(() => setDismissed(true), 6000);
      return () => clearTimeout(t);
    }
  }, [connected]);

  if (!connected && !error) return null;
  if (dismissed && !error) return null;

  return (
    <div className="mb-6 space-y-3">
      {connected && !dismissed && (
        <div className="flex items-start gap-3 p-4 bg-teal-tint border border-teal/30 rounded-xl">
          <CheckCircle2 size={18} className="text-teal mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Facebook connected</p>
            <p className="text-xs text-faint">Your Facebook Ads data is now available in Looker Studio.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Couldn't complete the connection</p>
            <p className="text-xs text-faint break-all">{decodeURIComponent(error)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoonCard({
  icon,
  iconBg,
  name,
  destination,
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  destination: string;
  description: string;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-card overflow-hidden opacity-80">
      <header className="flex items-start gap-3 px-6 py-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[15px] font-semibold text-ink">{name}</h2>
            <span className="text-faint text-xs">→</span>
            <span className="text-[13px] font-medium text-muted">{destination}</span>
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-surface text-faint">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-faint mt-1 leading-relaxed max-w-[58ch]">
            {description}
          </p>
        </div>
      </header>
    </section>
  );
}

export default function LookerStudioConnectorsPage() {
  // Bumping this re-keys MetaConnectorCard so it re-fetches after OAuth or
  // disconnect actions complete elsewhere on the page.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <AdminLayout>
      {() => (
        <div className="flex flex-col h-full">
          <PageHeader
            title="Integrations"
            description="Connect your ad and CRM platforms once, then pull live data into any Looker Studio report using the AgencyViz connector."
          />

          <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
            <div className="max-w-3xl">
              <Suspense fallback={null}>
                <Banners />
              </Suspense>

              <div className="mb-3">
                <span className="text-2xs font-semibold uppercase tracking-wider text-faint">
                  Available
                </span>
              </div>
              <MetaConnectorCard refreshKey={refreshKey} onChange={refresh} />

              <div className="mt-8 mb-3">
                <span className="text-2xs font-semibold uppercase tracking-wider text-faint">
                  Coming soon
                </span>
              </div>
              <ComingSoonCard
                icon={<Workflow size={20} className="text-white" />}
                iconBg="bg-[#0F766E]"
                name="GoHighLevel"
                destination="Looker Studio"
                description="Pull leads, opportunities, pipeline stages, and contact activity from GHL sub-accounts into Looker Studio."
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
