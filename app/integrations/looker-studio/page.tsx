// app/integrations/looker-studio/page.tsx
//
// Looker Studio connector setup page. Shows deployment IDs and instructions
// for adding AgencyViz connectors to Looker Studio reports.
// Auth/connection setup lives in Settings → Integrations.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, Copy, Check, Settings, ShieldAlert,
  Loader2, Trash2, Eye, EyeOff,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import Image from 'next/image';
import Link from 'next/link';

const META_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_META || '';
const GHL_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_GHL || '';

function humanizeError(raw: string): string {
  const decoded = decodeURIComponent(raw);
  if (/token|auth|expired|revoked/i.test(decoded))
    return 'Your Meta connection has expired or was revoked. Reconnect in Settings → Integrations, then try again.';
  if (/permission|scope|access/i.test(decoded))
    return 'The connection is missing required permissions. Disconnect and reconnect with the correct ad account scopes.';
  if (/rate.?limit|too many/i.test(decoded))
    return 'Too many requests. Wait a minute, then try again.';
  if (/network|timeout|fetch/i.test(decoded))
    return 'Could not reach the server. Check your connection and try again.';
  return 'Something went wrong connecting your account. Try again, or contact support if the problem persists.';
}

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
        <div className="flex items-start gap-3 p-4 bg-teal-tint border border-teal/30 rounded-2xl" role="status">
          <CheckCircle2 size={18} className="text-teal mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Connection updated</p>
            <p className="text-xs text-faint">Your integration was updated successfully.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl" role="alert">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Connection failed</p>
            <p className="text-xs text-prose">
              {humanizeError(error)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyDeploymentButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  };

  return (
    <div className="space-y-1.5">
      <Button
        variant="primary"
        size="sm"
        onClick={handleCopy}
        leftIcon={copied ? Check : Copy}
      >
        <span aria-live="polite">{copied ? 'Deployment ID copied' : 'Copy deployment ID'}</span>
      </Button>
      {failed && (
        <p className="text-xs text-red-500" role="alert">
          Could not copy. Select and copy manually: <code className="text-2xs bg-red-50 px-1.5 py-0.5 rounded">{text}</code>
        </p>
      )}
    </div>
  );
}

// ── GHL Per-Location Connections ──────────────────────────────────────

interface GhlLocation {
  location_id: string;
  location_name: string;
  token_valid: boolean;
  last_used_at: string | null;
}

function GhlLocationManager({
  locations,
  onStatusChange,
}: {
  locations: GhlLocation[];
  onStatusChange: () => void;
}) {
  const [locationName, setLocationName] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!token.trim() || !locationName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await authFetch('/api/connectors/ghl/agency-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), location_name: locationName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Connection failed');
        return;
      }
      setToken('');
      setLocationName('');
      onStatusChange();
    } catch {
      setError('Network error — try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (locationId: string) => {
    setRemovingId(locationId);
    try {
      await authFetch(`/api/connectors/ghl/agency-connect?location_id=${encodeURIComponent(locationId)}`, {
        method: 'DELETE',
      });
      onStatusChange();
    } catch {
      setError('Failed to remove.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="ml-7 space-y-3">
      {/* Connected locations */}
      {locations.length > 0 && (
        <div className="space-y-1.5">
          {locations.map((loc) => (
            <div key={loc.location_id} className="flex items-center justify-between gap-2 px-3 py-2 bg-surface border border-edge rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                {loc.token_valid ? (
                  <CheckCircle2 size={14} className="text-teal shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                )}
                <span className="text-xs font-medium text-ink truncate">{loc.location_name}</span>
                {!loc.token_valid && (
                  <span className="text-2xs text-amber-600">(token invalid)</span>
                )}
              </div>
              <button
                onClick={() => handleRemove(loc.location_id)}
                disabled={removingId === loc.location_id}
                className="text-faint hover:text-red-500 transition-colors shrink-0"
              >
                {removingId === loc.location_id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new location */}
      <div className="space-y-2">
        <p className="text-xs text-faint">
          Add a GHL sub-account. Create a Private Integration Token in the sub-account&apos;s
          Settings → Integrations with <em>Contacts (Read)</em> and <em>Opportunities (Read)</em> scopes.
        </p>
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="Location name (e.g. Client ABC)"
          className="w-full max-w-sm px-3 py-1.5 text-xs bg-surface border border-edge rounded-lg focus:outline-none focus:ring-1 focus:ring-teal"
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="pit_xxxxxxxx..."
              className="w-full px-3 py-1.5 text-xs bg-surface border border-edge rounded-lg pr-8 focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConnect}
            disabled={saving || !token.trim() || !locationName.trim()}
            leftIcon={saving ? Loader2 : undefined}
          >
            {saving ? 'Connecting…' : 'Add location'}
          </Button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

function ConnectorSetupCard({
  logo,
  name,
  deploymentId,
  description,
  status,
  connected,
  children,
}: {
  logo: string;
  name: string;
  deploymentId: string;
  description: string;
  status: 'available' | 'coming-soon';
  connected?: boolean;
  children?: React.ReactNode;
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-edge text-faint font-medium">
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
            {children ? (
              children
            ) : connected ? (
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
            {deploymentId ? (
              <div className="ml-7">
                <CopyDeploymentButton text={deploymentId} />
              </div>
            ) : (
              <div className="ml-7 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  Deployment ID not configured. Contact your admin to set up the Looker Studio connector.
                </p>
              </div>
            )}
          </div>

          {/* Step 5 — What to expect */}
          <div className="ml-7 mt-2 px-4 py-3 bg-surface rounded-xl border border-edge/50">
            <p className="text-xs font-semibold text-ink mb-1.5">What to expect in Looker Studio</p>
            <ul className="text-xs text-muted space-y-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-teal shrink-0 mt-0.5" />
                The connector appears as <strong className="text-ink">AgencyViz — {name}</strong> after validation.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-teal shrink-0 mt-0.5" />
                You will be prompted to authorize with your AgencyViz account (OAuth).
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-teal shrink-0 mt-0.5" />
                Once authorized, choose your data source and date range to start pulling data.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

type HealthData = {
  status: 'healthy' | 'upgrade_available' | 'deprecated' | 'error';
  pinned_version: string;
  latest_version: string | null;
  checked_at: string;
};

function ApiHealthBanner({ health }: { health: HealthData | null }) {
  if (!health || health.status === 'healthy') return null;

  const isUrgent = health.status === 'deprecated' || health.status === 'error';
  const checkedDate = new Date(health.checked_at).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl mb-6 ${
      isUrgent
        ? 'bg-red-50 border border-red-200'
        : 'bg-amber-50 border border-amber-200'
    }`} role="alert">
      <ShieldAlert size={18} className={`${isUrgent ? 'text-red-500' : 'text-amber-600'} mt-0.5 shrink-0`} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${isUrgent ? 'text-red-900' : 'text-amber-900'}`}>
          {isUrgent ? 'Meta API Version Deprecated' : 'Meta API Upgrade Available'}
        </p>
        <p className={`text-xs ${isUrgent ? 'text-red-700' : 'text-amber-700'} mt-0.5`}>
          {isUrgent
            ? `The pinned version ${health.pinned_version} is no longer responding. ${health.latest_version ? `Upgrade to ${health.latest_version}.` : 'Check the Meta Graph API changelog for the latest version.'}`
            : `Meta has released ${health.latest_version}. The connector is currently on ${health.pinned_version} — consider upgrading before it reaches end-of-life.`
          }
        </p>
        <p className={`text-2xs ${isUrgent ? 'text-red-400' : 'text-amber-400'} mt-1`}>
          Last checked {checkedDate}
        </p>
      </div>
    </div>
  );
}

export default function LookerStudioPage() {
  const [metaConnected, setMetaConnected] = useState(false);
  const [apiHealth, setApiHealth] = useState<HealthData | null>(null);
  const [ghlLocations, setGhlLocations] = useState<GhlLocation[]>([]);
  const [ghlVersion, setGhlVersion] = useState(0);

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

        const healthRes = await fetch('/api/connectors/meta/health', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (healthRes.ok) {
          const healthJson = await healthRes.json();
          if (healthJson.data) setApiHealth(healthJson.data);
        }
      } catch {
        // Silent — just show the "Go to Integrations" fallback
      }
    }
    checkMeta();
  }, []);

  useEffect(() => {
    async function checkGhl() {
      try {
        const res = await authFetch('/api/connectors/ghl/agency-connect');
        if (!res.ok) return;
        const json = await res.json();
        if (json.data) {
          setGhlLocations(json.data.locations || []);
        }
      } catch {
        // Silent
      }
    }
    checkGhl();
  }, [ghlVersion]);

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

              <ApiHealthBanner health={apiHealth} />

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
                  status="available"
                  connected={ghlLocations.some((l) => l.token_valid)}
                >
                  <GhlLocationManager
                    locations={ghlLocations}
                    onStatusChange={() => setGhlVersion((v) => v + 1)}
                  />
                </ConnectorSetupCard>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
