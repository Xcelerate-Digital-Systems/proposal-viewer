// components/admin/connectors/MetaConnectorCard.tsx
//
// Self-contained Facebook Ads → Looker Studio integration card. Owns the full
// two-step setup: (1) Connect Facebook accounts, (2) Add to Looker Studio via
// the deployment ID. Visual language follows the dashboard section pattern
// (shadow-card top-level + crisp header band + uppercase eyebrows for
// sub-sections).

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check, Copy, ExternalLink, Loader2, Plus, Trash2, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

// Apps Script deployment ID (AKfyc…) for the Meta Looker Studio community
// connector. Distinct from the Apps Script project's *script* id — Looker
// Studio's "Build with Apps Script" dialog expects the deployment id.
const META_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_LOOKER_DEPLOYMENT_ID_META || '';

type ConnectionStatus = 'active' | 'needs_reauth' | 'revoked';

interface Connection {
  id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  status: ConnectionStatus;
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
}

interface AdAccount {
  connection_id: string;
  ad_account_id: string;
  account_name: string | null;
  enabled: boolean;
}

interface AccountsResponse {
  success: true;
  data: { connections: Connection[]; accounts: AdAccount[] };
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
      <path
        fill="#ffffff"
        d="M14.5 21v-7.6h2.55l.38-2.96H14.5V8.55c0-.86.24-1.44 1.47-1.44h1.57V4.46c-.27-.04-1.2-.12-2.28-.12-2.25 0-3.79 1.37-3.79 3.9v2.2H8.9v2.96h2.58V21h3.02Z"
      />
    </svg>
  );
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusPill({
  state,
}: {
  state: 'connected' | 'needs_reauth' | 'disconnected';
}) {
  const config = {
    connected:    { label: 'Connected',     cls: 'bg-teal-tint text-teal' },
    needs_reauth: { label: 'Needs reauth',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    disconnected: { label: 'Not connected', cls: 'bg-surface text-faint' },
  }[state];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${config.cls}`}>
      {config.label}
    </span>
  );
}

function StepEyebrow({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-6 pt-5 pb-3">
      <span className="text-2xs font-semibold uppercase tracking-wider text-faint">
        {step}
      </span>
      <span className="text-[13px] font-semibold text-ink">{title}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

interface Props {
  /** Bump to force the card to re-fetch. */
  refreshKey?: number;
  onChange?: () => void;
}

export default function MetaConnectorCard({ refreshKey = 0, onChange }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ''}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connectors/meta/accounts', {
        headers: await authHeader(),
      });
      if (!res.ok) {
        setConnections([]);
        setAccounts([]);
        return;
      }
      const json = (await res.json()) as AccountsResponse;
      setConnections(json.data.connections);
      setAccounts(json.data.accounts);
    } catch {
      setConnections([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const connect = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/connectors/meta/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ redirect_to: '/integrations/looker-studio' }),
      });
      const json = await res.json();
      if (json.success && json.authorize_url) {
        window.location.href = json.authorize_url;
      } else {
        toast.error(json.error || 'Failed to start Facebook connection');
        setStarting(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start Facebook connection');
      setStarting(false);
    }
  };

  const disconnect = async (connection: Connection) => {
    const who = connection.meta_user_name || connection.meta_user_id;
    const ok = await confirm({
      title: 'Disconnect Facebook?',
      message: `This will revoke the connection for ${who}. Any Looker Studio reports using these ad accounts will stop receiving data until a team member reconnects.`,
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;

    setPendingDisconnect(connection.id);
    try {
      const res = await fetch('/api/connectors/meta/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ connection_id: connection.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to disconnect');
      toast.success(`Disconnected ${who}`);
      onChange?.();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setPendingDisconnect(null);
    }
  };

  const copyDeploymentId = async () => {
    try {
      await navigator.clipboard.writeText(META_DEPLOYMENT_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Clipboard blocked — copy the ID from the connector settings.');
    }
  };

  const activeConnections = connections.filter((c) => c.status !== 'revoked');
  const hasConnection = activeConnections.length > 0;
  const needsReauth = !hasConnection
    ? false
    : activeConnections.every((c) => c.status === 'needs_reauth');
  const headerState: 'connected' | 'needs_reauth' | 'disconnected' = loading
    ? 'disconnected'
    : needsReauth
      ? 'needs_reauth'
      : hasConnection
        ? 'connected'
        : 'disconnected';

  return (
    <section className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* Header band — matches dashboard section header */}
      <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#1877F2]">
            <FacebookGlyph />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-semibold text-ink">Facebook Ads</h2>
              <span className="text-faint text-xs">→</span>
              <span className="text-[13px] font-medium text-muted">Looker Studio</span>
              <StatusPill state={headerState} />
            </div>
            <p className="text-xs text-faint mt-1 leading-relaxed max-w-[58ch]">
              Pull campaign, ad set, ad, and creative performance from Meta into Looker Studio.
              Supports daily, weekly, and custom date ranges.
            </p>
          </div>
        </div>
      </header>

      {/* Step 1 — Connect Facebook */}
      <StepEyebrow
        step="Step 1"
        title="Connect a Facebook account"
        hint={hasConnection ? `${activeConnections.length} connected` : undefined}
      />
      <div className="px-6 pb-5">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-faint py-3">
            <Loader2 size={13} className="animate-spin" />
            Loading connections…
          </div>
        ) : hasConnection ? (
          <div className="space-y-2">
            {activeConnections.map((connection) => {
              const accountCount = accounts.filter(
                (a) => a.connection_id === connection.id,
              ).length;
              const isDisconnecting = pendingDisconnect === connection.id;
              return (
                <div
                  key={connection.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-teal-tint rounded-lg flex items-center justify-center shrink-0">
                      <Users size={15} className="text-teal" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink truncate">
                          {connection.meta_user_name || connection.meta_user_id}
                        </p>
                        {connection.status === 'needs_reauth' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Needs reauth
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-faint truncate">
                        {accountCount} ad account{accountCount === 1 ? '' : 's'} · last used{' '}
                        {formatRelativeTime(connection.last_used_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => disconnect(connection)}
                    disabled={isDisconnecting}
                    className="px-2.5 py-1.5 text-xs font-medium text-faint hover:text-red-500 rounded-md flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
                    title="Disconnect"
                  >
                    {isDisconnecting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              );
            })}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={connect}
                disabled={starting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:text-teal-hover disabled:opacity-50 transition-colors"
              >
                {starting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add another Facebook account
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-surface rounded-xl">
            <p className="text-xs text-muted leading-relaxed">
              Sign in with Facebook to authorize AgencyViz to read your ad account performance.
              Each team member can connect their own Facebook account.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={connect}
              loading={starting}
              className="shrink-0"
            >
              Connect Facebook
            </Button>
          </div>
        )}
      </div>

      {/* Step 2 — Add to Looker Studio */}
      <div className="border-t border-gray-100 bg-surface/50">
        <StepEyebrow
          step="Step 2"
          title="Add the connector to Looker Studio"
        />
        <div className="px-6 pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={copyDeploymentId}
              disabled={!META_DEPLOYMENT_ID}
              title={META_DEPLOYMENT_ID ? `Deployment ID: ${META_DEPLOYMENT_ID}` : undefined}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal text-white hover:bg-teal-hover disabled:opacity-50 transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Deployment ID copied' : 'Copy deployment ID'}
            </button>
            <a
              href="https://lookerstudio.google.com"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-ink border border-gray-100 rounded-lg hover:bg-white transition-colors"
            >
              Open Looker Studio
              <ExternalLink size={12} />
            </a>
          </div>

          <ol className="space-y-2.5 text-xs text-muted leading-relaxed">
            <li className="flex gap-3">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-white border border-gray-200 text-faint text-[10px] font-semibold">
                1
              </span>
              <span className="pt-0.5">
                In Looker Studio, click <span className="font-medium text-ink">Create → Data source</span>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-white border border-gray-200 text-faint text-[10px] font-semibold">
                2
              </span>
              <span className="pt-0.5">
                Scroll to <span className="font-medium text-ink">Build your own</span> and choose{' '}
                <span className="font-medium text-ink">Build with Apps Script</span>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-white border border-gray-200 text-faint text-[10px] font-semibold">
                3
              </span>
              <span className="pt-0.5">
                Paste the deployment ID into the <span className="font-medium text-ink">Deployment ID</span> field,
                click <span className="font-medium text-ink">Validate</span>, then{' '}
                <span className="font-medium text-ink">Next</span>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-white border border-gray-200 text-faint text-[10px] font-semibold">
                4
              </span>
              <span className="pt-0.5">
                Sign in with AgencyViz when prompted, then pick the ad account to pull data from.
              </span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
