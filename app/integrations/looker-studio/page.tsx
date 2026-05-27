// app/integrations/looker-studio/page.tsx
//
// Integration hub. Each integration is rendered as a self-contained two-step
// card (Step 1: connect the source platform, Step 2: wire it into Looker
// Studio via the Apps Script deployment ID). The page is intentionally just a
// vertical stack of these cards — no cross-card chrome — so adding a new
// integration is one more card below.

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
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  description: string;
}) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 opacity-75">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-ink">{name}</h3>
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-faint">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-faint mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
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

          <div className="px-6 lg:px-10 py-8 max-w-3xl">
            <Suspense fallback={null}>
              <Banners />
            </Suspense>

            <div className="space-y-5">
              <MetaConnectorCard refreshKey={refreshKey} onChange={refresh} />

              <ComingSoonCard
                icon={<Workflow size={22} className="text-white" />}
                iconBg="bg-[#0F766E]"
                name="GoHighLevel → Looker Studio"
                description="Pull leads, opportunities, pipeline stages, and contact activity from GHL sub-accounts into Looker Studio."
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
