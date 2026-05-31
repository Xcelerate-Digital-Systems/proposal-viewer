// app/integrations/looker-studio/page.tsx
//
// Looker Studio connector setup page. Shows deployment IDs and instructions
// for adding AgencyViz connectors to Looker Studio reports.
// Auth/connection setup lives in Settings → Integrations.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle, BarChart3, CheckCircle2, Copy, Check,
  ExternalLink, Settings,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

const META_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_META || '';
const GHL_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_GHL || '';

function Banners() {
  const search = useSearchParams();
  const connected = search.get('connected') === '1';
  const error = search.get('error');
  const [dismissed, setDismissed] = useState(false);

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
        <div className="flex items-start gap-3 p-4 bg-teal-tint border border-teal/30 rounded-2xl">
          <CheckCircle2 size={18} className="text-teal mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Connection updated</p>
            <p className="text-xs text-faint">Your integration was updated successfully.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Something went wrong</p>
            <p className="text-xs text-faint break-all">{decodeURIComponent(error)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyDeploymentButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal text-white hover:bg-teal-hover transition-colors"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Deployment ID copied' : 'Copy deployment ID'}
    </button>
  );
}

function ConnectorSetupCard({
  logo,
  name,
  deploymentId,
  description,
  status,
  connected,
}: {
  logo: string;
  name: string;
  deploymentId: string;
  description: string;
  status: 'available' | 'coming-soon';
  connected?: boolean;
}) {
  const isAvailable = status === 'available';

  return (
    <div className={`bg-surface border border-edge rounded-2xl overflow-hidden ${!isAvailable ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
        <div className="flex items-center gap-3">
          <Image
            src={logo}
            alt={`${name} logo`}
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{name}</h3>
              <span className="text-faint text-xs">→</span>
              <span className="text-xs font-medium text-muted">Looker Studio</span>
            </div>
            <p className="text-xs text-faint">{description}</p>
          </div>
        </div>
        {!isAvailable && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-wash text-faint font-medium">
            Coming soon
          </span>
        )}
      </div>

      {/* Setup instructions */}
      {isAvailable && (
        <div className="px-6 py-5 space-y-5">
          {/* Step 1 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-teal-tint text-teal text-xs font-bold flex items-center justify-center">1</span>
              <span className="text-xs font-semibold text-ink">Connect your account</span>
            </div>
            {connected ? (
              <div className="ml-7 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-teal" />
                <span className="text-xs font-medium text-teal">Connected</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-faint ml-7 mb-2">
                  Connect your {name} account in Settings → Integrations before adding the connector.
                </p>
                <div className="ml-7">
                  <Link href="/settings?tab=integrations">
                    <Button variant="outline" size="sm" leftIcon={Settings}>
                      Go to Integrations
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-teal-tint text-teal text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-xs font-semibold text-ink">Add a data source</span>
            </div>
            <p className="text-xs text-faint ml-7">
              In your Looker Studio report, go to <strong>Add a Data Source</strong>.
            </p>
          </div>

          {/* Step 3 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-teal-tint text-teal text-xs font-bold flex items-center justify-center">3</span>
              <span className="text-xs font-semibold text-ink">Find the partner connector</span>
            </div>
            <p className="text-xs text-faint ml-7">
              Scroll down to <strong>Partner Connectors</strong>. Select the first available connector — <strong>Build Your Own, by Google</strong>.
            </p>
          </div>

          {/* Step 4 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-teal-tint text-teal text-xs font-bold flex items-center justify-center">4</span>
              <span className="text-xs font-semibold text-ink">Paste the deployment ID</span>
            </div>
            <p className="text-xs text-faint ml-7 mb-3">
              Paste the deployment ID into the input field, click <strong>Validate</strong>, then select the <strong>AgencyViz Connector</strong> and follow the setup from there.
            </p>
            {deploymentId && (
              <div className="ml-7">
                <CopyDeploymentButton text={deploymentId} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LookerStudioPage() {
  const [metaConnected, setMetaConnected] = useState(false);

  useEffect(() => {
    async function checkMeta() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/connectors/meta/accounts', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const active = (json.data?.connections || []).filter(
          (c: { status: string }) => c.status !== 'revoked',
        );
        setMetaConnected(active.length > 0);
      } catch {
        // Silent — just show the "Go to Integrations" fallback
      }
    }
    checkMeta();
  }, []);

  return (
    <AdminLayout>
      {() => (
        <div className="flex flex-col h-full">
          <PageHeader
            title="Looker Studio"
            description="Add AgencyViz connectors to your Looker Studio reports. Connect your accounts in Settings → Integrations first, then use the deployment IDs below."
          />

          <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
            <div className="max-w-3xl">
              <Suspense fallback={null}>
                <Banners />
              </Suspense>

              <div data-tour="integrations-connectors" className="space-y-6">
                <ConnectorSetupCard
                  logo="/integrations/facebook-icon.png"
                  name="Meta Ads"
                  deploymentId={META_DEPLOYMENT_ID}
                  description="Pull ad spend, impressions, clicks, conversions, and creative data into Looker Studio reports."
                  status="available"
                  connected={metaConnected}
                />

                <ConnectorSetupCard
                  logo="/integrations/go-high-level-icon.svg"
                  name="GoHighLevel"
                  deploymentId={GHL_DEPLOYMENT_ID}
                  description="Pull leads, opportunities, pipeline stages, and contact activity into Looker Studio reports."
                  status="coming-soon"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
