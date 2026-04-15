// app/integrations/looker-studio/page.tsx
//
// Hub for data-source connectors that feed the AgencyViz Looker Studio
// connector. Each card is a single integration; no per-account detail is
// shown here (keep the page scannable).

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ExternalLink, BarChart3, Workflow } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import MetaConnectorCard from '@/components/admin/connectors/MetaConnectorCard';
import ConnectorCard from '@/components/admin/connectors/ConnectorCard';

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

export default function LookerStudioConnectorsPage() {
  return (
    <AdminLayout>
      {() => (
        <div className="px-6 lg:px-10 py-8 max-w-5xl">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-11 h-11 bg-teal-tint rounded-[14px] flex items-center justify-center shrink-0">
              <BarChart3 size={22} className="text-teal" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-ink">Looker Studio</h1>
              <p className="text-sm text-faint mt-1">
                Connect your ad and CRM platforms once, then pull live data into any Looker Studio
                report using the AgencyViz connector.
              </p>
            </div>
            <a
              href="https://lookerstudio.google.com"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-faint hover:text-ink border border-line rounded-lg hover:bg-surface transition-colors"
            >
              Open Looker Studio
              <ExternalLink size={12} />
            </a>
          </div>

          <Suspense fallback={null}>
            <Banners />
          </Suspense>

          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Data sources
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetaConnectorCard />

            <ConnectorCard
              icon={<Workflow size={22} className="text-white" />}
              iconBg="bg-[#0F766E]"
              name="GoHighLevel"
              description="Pull leads, opportunities, pipeline stages, and contact activity from GHL sub-accounts into Looker Studio."
              status="coming_soon"
              primaryAction={{
                label: 'Coming soon',
                onClick: () => {},
                disabled: true,
              }}
            />
          </div>

          <div className="mt-10 p-5 bg-surface border border-line rounded-2xl">
            <p className="text-sm font-semibold text-ink mb-1">Using the connector</p>
            <p className="text-xs text-faint leading-relaxed">
              Once a data source above is connected, install the AgencyViz Community Connector inside
              Looker Studio and authenticate with your AgencyViz API key. Each connected data source
              will show up as a data type you can blend into reports.
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
