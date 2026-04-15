// app/integrations/looker-studio/page.tsx
//
// Hub for data-source connectors that feed the AgencyViz Looker Studio
// connector. Each card is a single integration; no per-account detail is
// shown here (keep the page scannable).

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ExternalLink, BarChart3, Workflow, Copy, Check } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import MetaConnectorCard from '@/components/admin/connectors/MetaConnectorCard';
import MetaConnectionsManager from '@/components/admin/connectors/MetaConnectionsManager';
import ConnectorCard from '@/components/admin/connectors/ConnectorCard';

const LOOKER_DEPLOYMENT_ID =
  process.env.NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID ||
  '1kZtHBdop8gy0gIAaRnuugj7n2uWP9ru7r31tDG5NILuZPfS-jJcGtOrV';

function DeploymentIdField() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(LOOKER_DEPLOYMENT_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (e.g., insecure origin) — user can still select the text.
    }
  };

  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 min-w-0 px-3 py-2 text-[12px] font-mono text-ink bg-white border border-line rounded-lg overflow-x-auto whitespace-nowrap">
        {LOOKER_DEPLOYMENT_ID}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink bg-white border border-line rounded-lg hover:bg-surface transition-colors shrink-0"
        aria-label="Copy deployment ID"
      >
        {copied ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

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
  // Bumping this re-keys both MetaConnectorCard and MetaConnectionsManager so
  // they re-fetch after any mutation (toggle, disconnect) in the manager.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

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
            <MetaConnectorCard refreshKey={refreshKey} />

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

          <MetaConnectionsManager refreshKey={refreshKey} onChange={refresh} />

          <div className="mt-10 p-6 bg-surface border border-line rounded-2xl">
            <p className="text-sm font-semibold text-ink mb-1">Connecting in Looker Studio</p>
            <p className="text-xs text-faint leading-relaxed mb-5">
              Once a data source above is connected, paste the deployment ID below into Looker
              Studio to load the AgencyViz connector.
            </p>

            <div className="mb-5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                Deployment ID
              </label>
              <DeploymentIdField />
            </div>

            <ol className="space-y-3 text-xs text-ink leading-relaxed list-decimal pl-5 marker:text-muted marker:font-semibold">
              <li>
                Open{' '}
                <a
                  href="https://lookerstudio.google.com"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-teal hover:underline"
                >
                  Looker Studio
                </a>{' '}
                and click <span className="font-semibold">Create → Data source</span>.
              </li>
              <li>
                Scroll to <span className="font-semibold">Build your own</span> and choose{' '}
                <span className="font-semibold">Build with Apps Script</span> (aka "Create from
                scratch").
              </li>
              <li>
                Paste the deployment ID above into the{' '}
                <span className="font-semibold">Deployment ID</span> field and click{' '}
                <span className="font-semibold">Validate</span>, then{' '}
                <span className="font-semibold">Next</span>.
              </li>
              <li>
                When prompted, sign in with AgencyViz to authorize the connector, then pick the
                ad account to pull data from.
              </li>
            </ol>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
