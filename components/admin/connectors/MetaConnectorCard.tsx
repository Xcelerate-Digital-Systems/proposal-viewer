// components/admin/connectors/MetaConnectorCard.tsx
//
// Self-contained Facebook Ads → Looker Studio integration card. Owns the full
// two-step setup: (1) Connect Facebook accounts, (2) Add to Looker Studio via
// the deployment ID. Replaces the previous split between MetaConnectorCard +
// MetaConnectionsManager.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Plus, Trash2, Users } from 'lucide-react';
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
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
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
    disconnected: { label: 'Not connected', cls: 'bg-gray-100 text-faint' },
  }[state];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${config.cls}`}>
      {config.label}
    </span>
  );
}

function StepLabel({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-tint text-teal text-[11px] font-semibold">
        {index}
      </span>
      <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
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
    <div className="bg-white border border-line rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#1877F2]">
          <FacebookGlyph />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-ink">Facebook Ads → Looker Studio</h3>
            <StatusPill state={headerState} />
          </div>
          <p className="text-xs text-faint mt-1 leading-relaxed">
            Pull campaign, ad set, ad, and creative performance from Meta into Looker Studio.
            Supports daily, weekly, and custom date ranges.
          </p>
        </div>
      </div>

      {/* Step 1 — Connect Facebook */}
      <div className="px-5 pb-5 pt-1 border-t border-line">
        <div className="pt-5">
          <StepLabel index={1} title="Connect a Facebook account" />

          {loading ? (
            <div className="h-[60px] rounded-xl bg-surface animate-pulse" />
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
                    className="flex items-start gap-3 bg-surface border border-line rounded-xl p-3.5"
                  >
                    <div className="w-9 h-9 bg-teal-tint rounded-lg flex items-center justify-center shrink-0">
                      <Users size={16} className="text-teal" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink truncate">
                          {connection.meta_user_name || connection.meta_user_id}
                        </p>
                        {connection.status === 'needs_reauth' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Needs reauth
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-faint mt-0.5">
                        {accountCount} ad account{accountCount === 1 ? '' : 's'} · last used{' '}
                        {formatRelativeTime(connection.last_used_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => disconnect(connection)}
                      disabled={isDisconnecting}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      <Trash2 size={12} />
                      {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </div>
                );
              })}
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={Plus}
                  onClick={connect}
                  loading={starting}
                >
                  Add another Facebook account
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-xs text-faint leading-relaxed mb-3">
                  Sign in with Facebook to authorize AgencyViz to read your ad account
                  performance. Each team member can connect their own Facebook account.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={connect}
                  loading={starting}
                >
                  Connect Facebook
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2 — Add to Looker Studio */}
      <div className="px-5 pb-5 border-t border-line bg-surface/40">
        <div className="pt-5">
          <StepLabel index={2} title="Add the connector to Looker Studio" />

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={copyDeploymentId}
              leftIcon={copied ? Check : Copy}
              disabled={!META_DEPLOYMENT_ID}
              title={META_DEPLOYMENT_ID ? `Deployment ID: ${META_DEPLOYMENT_ID}` : undefined}
            >
              {copied ? 'Deployment ID copied' : 'Copy deployment ID'}
            </Button>
            <a
              href="https://lookerstudio.google.com"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-faint hover:text-ink border border-line rounded-lg hover:bg-white transition-colors"
            >
              Open Looker Studio
              <ExternalLink size={12} />
            </a>
          </div>

          <ol className="space-y-2 text-xs text-ink leading-relaxed list-decimal pl-5 marker:text-muted marker:font-semibold">
            <li>
              In Looker Studio, click <span className="font-semibold">Create → Data source</span>.
            </li>
            <li>
              Scroll to <span className="font-semibold">Build your own</span> and choose{' '}
              <span className="font-semibold">Build with Apps Script</span>.
            </li>
            <li>
              Paste the deployment ID into the{' '}
              <span className="font-semibold">Deployment ID</span> field, click{' '}
              <span className="font-semibold">Validate</span>, then{' '}
              <span className="font-semibold">Next</span>.
            </li>
            <li>
              Sign in with AgencyViz when prompted, then pick the ad account to pull data from.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
